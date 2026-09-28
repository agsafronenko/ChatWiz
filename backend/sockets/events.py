# --- START OF FILE sockets/events.py ---

from flask import request
from flask_socketio import emit, join_room, leave_room
from services.message_service import message_service
from utils.name_generator import generate_random_name
from datetime import datetime, timedelta
import uuid
import time # For potential delays

# Main user store - maps user IDs to their data
users = {}
# Session mapping - maps session IDs to user ID
session_to_user_id = {}
# Map Google IDs to our user IDs
google_id_to_user_id = {}
# Room store - {room_name: {'type': 'public'/'private', 'creator': user_id (optional), 'members': {user_id1, ...}}}
rooms = {}
# User room mapping - {user_id: current_room_name}
user_rooms = {}
# Track recent disconnects for refresh handling (no change needed here)
recent_disconnects = {}


def initialize_default_room():
    """Ensure the default 'main' room exists."""
    if 'main' not in rooms:
        rooms['main'] = {'type': 'public', 'members': set()}
        print("Initialized default room 'main'")

def get_user_id_from_sid(sid):
    """Helper to get user ID from session ID."""
    return session_to_user_id.get(sid)

def get_user_from_id(user_id):
    """Helper to get user data from user ID."""
    return users.get(user_id)

def get_room_list_for_user(target_user_id):
    """Generate the list of rooms visible to a specific user."""
    visible_rooms = {}
    for name, data in rooms.items():
        if data['type'] == 'public' or target_user_id in data['members']:
            visible_rooms[name] = {
                'type': data['type'],
                'members': list(data['members']) # Send as list
            }
    return visible_rooms

def get_full_user_list():
    """ Get a dictionary of all online users {user_id: username} """
    online_users = {}
    for user_id, user_data in users.items():
         # Ensure user has an active session
        if any(uid == user_id for uid in session_to_user_id.values()):
             online_users[user_id] = user_data['username']
    return online_users



# Modified broadcast_room_update to explicitly use socketio instance
def broadcast_room_update(socketio, room_name=None): # Pass socketio instance
    """
    Broadcasts updated room list and optionally user list for a specific room.
    Uses socketio.emit for background task compatibility.
    """
    print(f"Broadcasting update (using socketio.emit), affected room: {room_name}")

    # Prepare the global user data once
    all_users_data = users

    # Send personalized room lists to each user
    all_online_user_ids = set(session_to_user_id.values())
    for user_id in all_online_user_ids:
        # Find a session for this user_id to emit to
        target_sid = next((sid for sid, uid in session_to_user_id.items() if uid == user_id), None)
        if target_sid:
            user_specific_rooms = get_room_list_for_user(user_id)
            # *** FIX: Use socketio.emit ***
            socketio.emit('update_room_list', {
                'rooms': user_specific_rooms,
                'users': all_users_data # Send the prepared user data
                },
                to=target_sid # Use 'to' instead of 'room' for specific SID target
            )
            # print(f"Sent room list update to user {user_id} (sid: {target_sid})") # Can be noisy

    # If a specific room's users changed, broadcast that room's user list
    if room_name and room_name in rooms:
         user_ids_in_room = list(rooms[room_name]['members'])
         # Ensure users still exist before getting username
         usernames_in_room = {uid: users[uid]['username'] for uid in user_ids_in_room if uid in users}
         # *** FIX: Use socketio.emit ***
         socketio.emit('update_user_list',
             {'room_name': room_name, 'users': usernames_in_room},
             room=room_name # Use 'room' when targeting a room
         )
         print(f"Sent user list update for room '{room_name}' to its members")


# Modified handle_user_leave_room to pass socketio
def handle_user_leave_room(socketio, user_id, room_name, sid, notify=True): # Pass socketio
    """Logic for when a user leaves a room."""
    if not room_name or room_name not in rooms or user_id not in rooms[room_name]['members']:
        return False

    print(f"User {user_id} leaving room {room_name}")
    user = get_user_from_id(user_id)
    username = user['username'] if user else 'Someone'

    # This leave_room is context-bound but might be okay if sid is valid? Test.
    # If it causes issues, this part might need rethinking in background task scenarios.
    try:
         leave_room(room_name, sid=sid)
    except RuntimeError as e:
         print(f"Warning: Could not execute leave_room for sid {sid} (likely background task): {e}")
         # State is managed below anyway, so might be acceptable.

    rooms[room_name]['members'].remove(user_id)
    if user_id in user_rooms and user_rooms[user_id] == room_name:
         del user_rooms[user_id]

    if notify:
        leave_message = message_service.add_message(room_name, 'System', f"{username} has left the room.")
        if leave_message:
            # *** FIX: Use socketio.emit for potential background calls ***
            socketio.emit('new_message', leave_message.to_dict(), room=room_name)

    if not rooms[room_name]['members'] and room_name != 'main':
        print(f"Room '{room_name}' is empty, deleting.")
        message_service.remove_room_history(room_name)
        del rooms[room_name]
        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio) # Update everyone's room list
        return True
    else:
        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, room_name) # Update lists for the room left
        return False


def register_socket_events(socketio): # socketio instance is passed here
    """Register all socket.io event handlers"""

    initialize_default_room()

    @socketio.on('connect')
    def handle_connect():
        # ... (no changes needed here, uses context-bound emit correctly) ...
        session_id = request.sid
        print(f"Client connected: {session_id}")

        user_id = request.args.get('user_id')
        is_new_connection = True
        user = None

        if user_id and user_id in users:
            print(f"Reconnect attempt with existing user_id: {user_id}")
            user = users[user_id]
            is_new_connection = False
            if user_id in recent_disconnects:
                print(f"Recognized refresh for user {user_id}")
                del recent_disconnects[user_id]
        else:
            user_id = str(uuid.uuid4())
            username = generate_random_name()
            print(f"New user connection, assigning ID: {user_id}, Name: {username}")
            users[user_id] = {
                'username': username, 'google_data': None,
                'original_name': username, 'is_logged_in': False
            }
            user = users[user_id]

        session_to_user_id[session_id] = user_id

        default_room = 'main'
        # Ensure user is actually added to the room members set
        if default_room not in rooms: initialize_default_room() # Safety check
        join_room(default_room, sid=session_id)
        rooms[default_room]['members'].add(user_id)
        user_rooms[user_id] = default_room
        print(f"User {user_id} joined default room 'main'")

        emit('user_info', {
            'user_id': user_id, 'username': user['username'],
            'is_logged_in': user['is_logged_in'], 'current_room': default_room
        })
        emit('chat_history', message_service.get_messages(default_room))
        emit('update_room_list', {
             'rooms': get_room_list_for_user(user_id), 'users': users
         })
        # Send full online user list on connect too
        emit('update_online_users', get_full_user_list())

        if is_new_connection or user_id not in recent_disconnects:
             join_message = message_service.add_message(default_room, 'System', f"{user['username']} has joined the chat.")
             if join_message:
                emit('new_message', join_message.to_dict(), room=default_room) # Use context emit here

        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, default_room) # Update users in 'main'
        # *** FIX: Use socketio.emit for global broadcast ***
        socketio.emit('update_online_users', get_full_user_list()) # Update everyone's online list


    @socketio.on('disconnect')
    def handle_disconnect():
        session_id = request.sid
        print(f"Client disconnecting: {session_id}")

        user_id = get_user_id_from_sid(session_id)
        if not user_id or user_id not in users:
            print("Disconnect: User ID not found or invalid for session.")
            # Clean up session mapping if it exists but points to invalid user
            if session_id in session_to_user_id:
                 del session_to_user_id[session_id]
            return

        user = get_user_from_id(user_id)
        username = user['username'] if user else 'Unknown User'
        current_room = user_rooms.get(user_id)

        recent_disconnects[user_id] = datetime.utcnow()

        if session_id in session_to_user_id:
            del session_to_user_id[session_id]

        has_other_sessions = any(uid == user_id for uid in session_to_user_id.values())

        if not has_other_sessions:
            print(f"User {user_id} ({username}) has no more active sessions. Scheduling disconnect check.")
            # Pass the socketio instance to the background task target
            socketio.start_background_task(
                check_permanent_disconnect,
                socketio, # Pass the instance
                user_id,
                username,
                current_room
            )
        else:
             print(f"User {user_id} ({username}) still has other active sessions.")

    # This function runs in background, MUST use socketio.emit
    def check_permanent_disconnect(socketio, user_id, username, room_name): # Receives socketio instance
        """Check if a disconnect is permanent after a delay."""
        print(f"Starting disconnect check for {user_id} ({username}) in room {room_name}")
        socketio.sleep(5)

        if user_id in recent_disconnects:
             print(f"Disconnect check: {user_id} still marked as disconnected.")
             has_active_sessions = any(uid == user_id for uid in session_to_user_id.values())

             if not has_active_sessions:
                print(f"Disconnect confirmed for {user_id} ({username}). Proceeding with cleanup.")
                if room_name and room_name in rooms:
                   if user_id in rooms[room_name]['members']:
                       print(f"Removing {user_id} from room {room_name} members.")
                       # Note: We don't have a specific SID here.
                       # The state update is the primary goal.
                       rooms[room_name]['members'].remove(user_id)
                       if user_id in user_rooms:
                           del user_rooms[user_id]

                       leave_message = message_service.add_message(room_name, 'System', f"{username} has left the chat.")
                       if leave_message:
                           # *** FIX: Use socketio.emit ***
                           socketio.emit('new_message', leave_message.to_dict(), room=room_name)

                       if not rooms[room_name]['members'] and room_name != 'main':
                           print(f"Room '{room_name}' is empty after disconnect, deleting.")
                           message_service.remove_room_history(room_name)
                           del rooms[room_name]
                           # *** FIX: Pass socketio instance ***
                           broadcast_room_update(socketio) # Update everyone's room list
                       else:
                           # *** FIX: Pass socketio instance ***
                           broadcast_room_update(socketio, room_name) # Update this room's list

                # Determine if user data should be removed
                keep_user = False
                google_id = None
                if user_id in users and users[user_id].get('is_logged_in'):
                     google_id = users[user_id].get('google_data', {}).get('id')
                     if google_id and google_id in google_id_to_user_id and google_id_to_user_id[google_id] == user_id:
                         keep_user = True
                         print(f"Keeping user data for {user_id} due to Google ID association.")

                if not keep_user and user_id in users:
                     print(f"Removing user data for {user_id} ({username}).")
                     # Clean up Google ID mapping if needed
                     if google_id and google_id in google_id_to_user_id and google_id_to_user_id[google_id] == user_id:
                          del google_id_to_user_id[google_id]
                          print(f"Removed Google ID mapping for {google_id}")
                     del users[user_id]

                # *** FIX: Use socketio.emit for global broadcast ***
                socketio.emit('update_online_users', get_full_user_list())

             else:
                print(f"Disconnect check cancelled for {user_id}, reconnected or has other sessions.")

             # Clean up the marker regardless
             if user_id in recent_disconnects:
                del recent_disconnects[user_id]
        else:
             print(f"Disconnect check unnecessary for {user_id}, already reconnected or handled.")


    @socketio.on('authenticate')
    def handle_authentication(data):
        # This runs in request context, standard 'emit' is fine here
        # ... (logic for merging/updating users) ...
        session_id = request.sid
        current_user_id = get_user_id_from_sid(session_id)

        if not current_user_id or current_user_id not in users: return
        google_id = data.get('id')
        if not google_id: return

        user = users[current_user_id]
        old_username = user['username']
        current_room = user_rooms.get(current_user_id) # Get current room BEFORE potential merge

        # --- Google ID association logic (potential user merging) ---
        if google_id in google_id_to_user_id and google_id_to_user_id[google_id] != current_user_id:
            existing_user_id = google_id_to_user_id[google_id]
            if existing_user_id in users:
                print(f"Google ID {google_id} already linked to user {existing_user_id}. Merging session {session_id}.")
                temp_user_original_name = user.get('original_name', 'Anonymous')
                temp_user_id = current_user_id

                session_to_user_id[session_id] = existing_user_id
                current_user_id = existing_user_id
                user = users[existing_user_id]
                # Update new_username based on the existing user being merged *into*
                new_username = user.get('google_data', {}).get('name') or user['username']

                if current_room and temp_user_id in rooms.get(current_room, {}).get('members', set()):
                    # *** FIX: Pass socketio instance *** handle_user_leave_room needs it if called indirectly
                    # However, this specific call might be okay as it's in request context... let's try without passing first.
                    # If it fails, we'll pass socketio here too.
                    # For now, assume direct call within request context is okay.
                    # UPDATE: Let's pass socketio for safety, as leave_room might emit.
                    handle_user_leave_room(socketio, temp_user_id, current_room, session_id, notify=False)

                    if existing_user_id not in rooms[current_room]['members']:
                         join_room(current_room, sid=session_id)
                         rooms[current_room]['members'].add(existing_user_id)
                         user_rooms[existing_user_id] = current_room
                         print(f"Moved user {existing_user_id} to room {current_room} during merge.")
                    else:
                         user_rooms[existing_user_id] = current_room

                if temp_user_id in users:
                    del users[temp_user_id]
                    print(f"Removed temporary user {temp_user_id}.")

                merge_message = message_service.add_message(
                    current_room or 'main', 'System',
                    f"{temp_user_original_name} logged in and is now {new_username}."
                )
                if merge_message:
                    emit('new_message', merge_message.to_dict(), room=current_room or 'main') # Context emit OK

                # *** FIX: Pass socketio instance ***
                broadcast_room_update(socketio, current_room or 'main')
        else:
             # If not merging, set new_username from incoming data
             new_username = data.get('name')

        # --- End of User Merging Logic ---
        google_id_to_user_id[google_id] = current_user_id

        is_new_login = not user.get('is_logged_in', False)
        user['google_data'] = data
        user['is_logged_in'] = True
        user['username'] = new_username

        print(f"User {current_user_id} authenticated as {new_username}. New login: {is_new_login}")

        if is_new_login and old_username != new_username : # Notify on name change during NEW login
             if current_room and current_room in rooms:
                login_message = message_service.add_message(
                    current_room,'System',
                    f"{old_username} logged in as {new_username}"
                )
                if login_message:
                    emit('new_message', login_message.to_dict(), room=current_room) # Context emit OK

        # Send updated info back to the specific client
        emit('user_info', { # Context emit OK
            'user_id': current_user_id, 'username': user['username'],
            'is_logged_in': True, 'current_room': current_room
        })

        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, current_room)
        # *** FIX: Use socketio.emit for global broadcast ***
        socketio.emit('update_online_users', get_full_user_list())


    @socketio.on('deauthenticate')
    def handle_deauthentication():
        # This runs in request context, standard 'emit' is fine here
        session_id = request.sid
        user_id = get_user_id_from_sid(session_id)
        if not user_id or user_id not in users: return
        user = users[user_id]
        if not user.get('is_logged_in'): return

        logged_out_name = user['username']
        original_name = user['original_name']
        current_room = user_rooms.get(user_id)
        google_id = user.get('google_data', {}).get('id')

        print(f"User {user_id} ({logged_out_name}) deauthenticating.")

        user['username'] = original_name
        user['is_logged_in'] = False
        user['google_data'] = None

        if google_id and google_id in google_id_to_user_id and google_id_to_user_id[google_id] == user_id:
             del google_id_to_user_id[google_id]
             print(f"Removed Google ID association for {google_id}")

        if current_room and current_room in rooms:
            logout_message = message_service.add_message(
                current_room, 'System',
                f"{logged_out_name} logged out, now known as {original_name}."
            )
            if logout_message:
                emit('new_message', logout_message.to_dict(), room=current_room) # Context emit OK

        emit('user_info', { # Context emit OK
            'user_id': user_id, 'username': user['username'],
            'is_logged_in': False, 'current_room': current_room
        })

        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, current_room)
        # *** FIX: Use socketio.emit for global broadcast ***
        socketio.emit('update_online_users', get_full_user_list())


    @socketio.on('send_message')
    def handle_message(data):
        # Runs in request context, standard emit is fine
        session_id = request.sid
        user_id = get_user_id_from_sid(session_id)
        content = data.get('message', '').strip()

        if not user_id or not content:
            print(f"Message blocked: user_id={user_id}, content='{content}'")
            return
        user = get_user_from_id(user_id)
        if not user:
             print(f"Message blocked: User data not found for user_id={user_id}")
             return

        username = user['username']
        current_room = user_rooms.get(user_id)

        if not current_room or current_room not in rooms:
            print(f"Error: User {user_id} ({username}) in session {session_id} tried to send message but has no valid current room ('{current_room}').")
            emit('error_feedback', {'message': 'Cannot send message, not in a valid room.'}) # Context emit OK
            return

        print(f"User {user_id} ({username}) sending message to room {current_room}: {content}")
        message = message_service.add_message(current_room, username, content)

        if message:
            emit('new_message', message.to_dict(), room=current_room) # Context emit OK
            print(f"Emitted 'new_message' to room: {current_room}")
        else:
             print(f"Failed to create message object for room {current_room}")


    @socketio.on('join_room')
    def handle_join_room(data):
        # Runs in request context
        session_id = request.sid
        user_id = get_user_id_from_sid(session_id)
        target_room_name = data.get('room_name')

        if not user_id or not target_room_name or user_id not in users:
            emit('error_feedback', {'message': 'Invalid request to join room.'})
            return

        user = get_user_from_id(user_id)
        username = user['username']
        old_room_name = user_rooms.get(user_id)

        if old_room_name == target_room_name: return

        if target_room_name not in rooms:
            emit('error_feedback', {'message': f"Room '{target_room_name}' does not exist."})
            return

        target_room = rooms[target_room_name]
        can_join = False
        if target_room['type'] == 'public':
             can_join = True
        elif target_room['type'] == 'private' and user_id in target_room['members']:
             # User is already a member (e.g., creator or previously invited/accepted)
             can_join = True

        if not can_join:
             print(f"Join room failed: User {user_id} cannot join room '{target_room_name}'. Type: {target_room['type']}, Members: {target_room['members']}")
             emit('error_feedback', {'message': f"You cannot join the room '{target_room_name}'."})
             return

        print(f"User {user_id} ({username}) joining room '{target_room_name}' from '{old_room_name}'")

        if old_room_name:
            # *** FIX: Pass socketio instance *** (handle_user_leave_room might be called from background elsewhere)
            handle_user_leave_room(socketio, user_id, old_room_name, session_id)

        join_room(target_room_name, sid=session_id)
        # Ensure members set exists before adding
        if 'members' not in rooms[target_room_name]: rooms[target_room_name]['members'] = set()
        rooms[target_room_name]['members'].add(user_id)
        user_rooms[user_id] = target_room_name

        join_message = message_service.add_message(target_room_name, 'System', f"{username} has joined the room.")
        if join_message:
            emit('new_message', join_message.to_dict(), room=target_room_name) # Context emit OK

        emit('joined_room', { # Context emit OK
            'room_name': target_room_name,
            'history': message_service.get_messages(target_room_name)
        })

        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, target_room_name)


    @socketio.on('create_room')
    def handle_create_room(data):
        # Runs in request context
        session_id = request.sid
        user_id = get_user_id_from_sid(session_id)
        room_name = data.get('room_name', '').strip()
        room_type = data.get('type', 'public')

        if not user_id or not room_name or user_id not in users:
            emit('error_feedback', {'message': 'Invalid request to create room.'})
            return
        if room_name in rooms:
            emit('error_feedback', {'message': f"Room name '{room_name}' already exists."})
            return
        if room_type not in ['public', 'private']:
             emit('error_feedback', {'message': 'Invalid room type.'})
             return

        print(f"User {user_id} creating {room_type} room: '{room_name}'")

        rooms[room_name] = {
            'type': room_type,
            'members': {user_id}, # Creator starts in the room
            'creator': user_id if room_type == 'private' else None
        }

        old_room_name = user_rooms.get(user_id)
        if old_room_name:
             # *** FIX: Pass socketio instance ***
             handle_user_leave_room(socketio, user_id, old_room_name, session_id)

        join_room(room_name, sid=session_id)
        user_rooms[user_id] = room_name

        emit('joined_room', { # Context emit OK
            'room_name': room_name,
            'history': []
        })

        # *** FIX: Pass socketio instance ***
        broadcast_room_update(socketio, room_name) # Update lists including the new room


    @socketio.on('invite_user')
    def handle_invite_user(data):
        # Runs in request context
        session_id = request.sid
        inviter_id = get_user_id_from_sid(session_id)
        target_user_id = data.get('target_user_id')
        room_name = data.get('room_name')

        # ... (validations) ...
        if not all([inviter_id, target_user_id, room_name]):
            emit('error_feedback', {'message': 'Invalid invite request.'}); return
        if inviter_id not in users or target_user_id not in users:
            emit('error_feedback', {'message': 'Inviter or target user not found.'}); return
        if room_name not in rooms or rooms[room_name]['type'] != 'private':
            emit('error_feedback', {'message': 'Can only invite to existing private rooms.'}); return
        # Ensure members set exists before checking
        if inviter_id not in rooms[room_name].get('members', set()):
             emit('error_feedback', {'message': 'You must be in the room to invite others.'}); return
        if target_user_id in rooms[room_name].get('members', set()):
             emit('error_feedback', {'message': 'User is already in this room.'}); return

        inviter_name = users[inviter_id]['username']
        target_user_sessions = [sid for sid, uid in session_to_user_id.items() if uid == target_user_id]

        if not target_user_sessions:
             emit('error_feedback', {'message': 'Invited user is not currently online.'}); return

        print(f"User {inviter_id} ({inviter_name}) inviting user {target_user_id} to room '{room_name}'")

        for target_sid in target_user_sessions:
            emit('invite_notification', { # Context emit OK (sending to specific sid)
                'inviter_name': inviter_name, 'room_name': room_name
            }, to=target_sid)

        emit('success_feedback', {'message': f'Invitation sent to {users[target_user_id]["username"]}.'}) # Context emit OK


    @socketio.on('accept_invite')
    def handle_accept_invite(data):
        # Runs in request context
        session_id = request.sid
        user_id = get_user_id_from_sid(session_id)
        room_name = data.get('room_name')

        if not user_id or not room_name or user_id not in users:
            emit('error_feedback', {'message': 'Invalid invite acceptance.'}); return
        if room_name not in rooms or rooms[room_name]['type'] != 'private':
            emit('error_feedback', {'message': f"Cannot accept invite: Room '{room_name}' is not a valid private room."}); return

        # Ensure members set exists
        if 'members' not in rooms[room_name]: rooms[room_name]['members'] = set()

        if user_id in rooms[room_name]['members']:
             print(f"User {user_id} tried to accept invite for {room_name} but is already a member.")
             if user_rooms.get(user_id) != room_name:
                  handle_join_room({'room_name': room_name}) # Treat as a normal join
             return

        print(f"User {user_id} accepting invite to room '{room_name}'")

        rooms[room_name]['members'].add(user_id) # Add BEFORE join logic

        handle_join_room(data) # Let the join logic handle the rest

# --- End of register_socket_events ---
# --- END OF FILE sockets/events.py ---