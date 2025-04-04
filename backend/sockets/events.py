from flask import request
from flask_socketio import emit
from services.message_service import message_service
from utils.name_generator import generate_random_name
from datetime import datetime, timedelta

# Store active users with their session IDs
active_users = {}
# Store authenticated users with their actual names by user ID
authenticated_users = {}
# Map of user IDs to their display names
user_id_to_name = {}
# Track previous names for each session to handle name changes correctly
session_to_previous_names = {}
# Track recent disconnects to handle page refreshes
recent_disconnects = {}
# Track renamed users to prevent "left chat" messages after rename
renamed_users = set()

def register_socket_events(socketio):
    """Register all socket.io event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle new client connection"""
        session_id = request.sid
        
        # Check if the user is providing their previous username in the query parameters
        saved_username = None
        if request.args and 'username' in request.args:
            saved_username = request.args.get('username')
        
        is_reconnect = saved_username is not None
        
        if is_reconnect and saved_username not in [active_users[sid] for sid in active_users]:
            # Use the saved username if it's valid and not already in use
            username = saved_username
            
            # Check if this is a reconnect from a recent disconnect (page refresh)
            if saved_username in recent_disconnects:
                # Remove from recent disconnects to prevent duplicate "joined" messages
                del recent_disconnects[saved_username]
                
            # Also check if this was a renamed user
            if saved_username in renamed_users:
                renamed_users.remove(saved_username)
        else:
            # Generate a new random name
            username = generate_random_name()
        
        active_users[session_id] = username
        
        # Send user their assigned username
        emit('user_info', {'username': username})
        
        # Send chat history to the new user
        emit('chat_history', message_service.get_messages())
        
        # Notify all users about the new connection unless it's a reconnect
        if not is_reconnect:
            system_message = message_service.add_message('System', f'{username} has joined the chat')
            emit('new_message', system_message.to_dict(), broadcast=True)
    
    @socketio.on('authenticate')
    def handle_authentication(data):
        """Handle user authentication"""
        session_id = request.sid
        
        if 'name' in data and 'id' in data:
            user_id = data['id']
            new_username = data['name']
            
            # Check if this user ID is already known
            previous_username = user_id_to_name.get(user_id)
            
            # Store authenticated user info
            authenticated_users[session_id] = {
                'id': user_id,
                'name': new_username,
                'isGoogleUser': data.get('isGoogleUser', False)
            }
            
            old_username = active_users.get(session_id)
            
            # Update the user ID to name mapping
            user_id_to_name[user_id] = new_username
            
            # Check if this is a page refresh for an already authenticated user
            is_reconnect = previous_username == new_username
            
            # Only announce name change if it's a new authentication or username actually changed
            if old_username and old_username != new_username and not is_reconnect:
                # Record previous name for this session to handle disconnects properly
                if session_id not in session_to_previous_names:
                    session_to_previous_names[session_id] = []
                session_to_previous_names[session_id].append(old_username)
                
                active_users[session_id] = new_username
                
                # Notify all users about the username change
                system_message = message_service.add_message(
                    'System', 
                    f'{old_username} is now known as {new_username}'
                )
                emit('new_message', system_message.to_dict(), broadcast=True)
                
                # Add old name to renamed_users to prevent "left the chat" message
                renamed_users.add(old_username)
                
                # Also add the old name to recent_disconnects to prevent "joined the chat" message
                recent_disconnects[old_username] = datetime.utcnow()
            else:
                # Just update the username without a system message
                active_users[session_id] = new_username
    
    @socketio.on('deauthenticate')
    def handle_deauthentication():
        """Handle user deauthentication"""
        session_id = request.sid
        
        if session_id in authenticated_users:
            # Get user ID before removing from authenticated users
            user_id = authenticated_users[session_id]['id']
            
            # Remove from authenticated users
            del authenticated_users[session_id]
            
            # Generate new random name
            username = generate_random_name()
            old_username = active_users.get(session_id)
            active_users[session_id] = username
            
            # Send user their new assigned username
            emit('user_info', {'username': username})
            
            # Notify all users about the username change
            if old_username and old_username != username:
                system_message = message_service.add_message(
                    'System', 
                    f'{old_username} is now known as {username}'
                )
                emit('new_message', system_message.to_dict(), broadcast=True)
                
                # Add old name to renamed_users to prevent "left the chat" message
                renamed_users.add(old_username)
            
            # Clean up user ID to name mapping if this was the last session for this user
            if not any(auth.get('id') == user_id for auth in authenticated_users.values()):
                if user_id in user_id_to_name:
                    del user_id_to_name[user_id]
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        session_id = request.sid
        if session_id in active_users:
            username = active_users[session_id]
            
            # Store the disconnected username with a timestamp to handle page refreshes properly
            recent_disconnects[username] = datetime.utcnow()
            
            # If this session had previous usernames, also add them to recent_disconnects
            # and to renamed_users set to prevent "left the chat" messages
            if session_id in session_to_previous_names:
                for prev_name in session_to_previous_names[session_id]:
                    if prev_name not in recent_disconnects:
                        recent_disconnects[prev_name] = datetime.utcnow()
                        renamed_users.add(prev_name)
                # Clean up the previous names tracking
                del session_to_previous_names[session_id]
            
            # Clean up old entries from recent_disconnects (older than 3 seconds)
            current_time = datetime.utcnow()
            expired_usernames = [
                u for u, t in recent_disconnects.items() 
                if current_time - t > timedelta(seconds=3)
            ]
            for u in expired_usernames:
                if u in recent_disconnects:
                    # Make sure this username isn't currently in use by any active session
                    if u not in active_users.values():
                        # Check if this name is not a previous name of any active user
                        is_previous_name = False
                        for names in session_to_previous_names.values():
                            if u in names:
                                is_previous_name = True
                                break
                                
                        # Only send "left the chat" if it's not a renamed user
                        if not is_previous_name and u not in renamed_users:
                            # Add "left the chat" message for truly disconnected users
                            system_message = message_service.add_message('System', f'{u} has left the chat')
                            emit('new_message', system_message.to_dict(), broadcast=True)
                    
                    del recent_disconnects[u]
            
            # Clean up old entries from renamed_users (after a while)
            # This prevents the set from growing indefinitely
            if len(renamed_users) > 100:  # Arbitrary limit
                renamed_users.clear()
            
            del active_users[session_id]
            
            # Clean up authenticated users if needed
            if session_id in authenticated_users:
                del authenticated_users[session_id]
    
    @socketio.on('send_message')
    def handle_message(data):
        """Handle new chat message"""
        session_id = request.sid
        content = data.get('message', '').strip()
        
        if not content:
            return
            
        username = active_users.get(session_id, 'Unknown User')
        message = message_service.add_message(username, content)
        
        # Broadcast the message to all connected clients
        emit('new_message', message.to_dict(), broadcast=True)