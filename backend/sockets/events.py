from flask import request
from flask_socketio import emit
from services.message_service import message_service
from utils.name_generator import generate_random_name
from datetime import datetime, timedelta
import uuid

# Main user store - maps user IDs to their data
users = {}

# Session mapping - maps session IDs to user ID
session_to_user_id = {}
# Track disconnects to handle page refreshes
recent_disconnects = {}
# Map Google IDs to our user IDs
google_id_to_user_id = {}

def register_socket_events(socketio):
    """Register all socket.io event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle new client connection"""
        session_id = request.sid
        
        # Check if the user is reconnecting with an existing user ID
        user_id = None
        if request.args and 'user_id' in request.args:
            user_id = request.args.get('user_id')
            
        is_new_user = False

        
        # If no user_id or invalid user_id, create a new user
        if not user_id or user_id not in users:
            user_id = str(uuid.uuid4())
            username = generate_random_name()
            is_new_user = True
            
            # Create new user entry
            users[user_id] = {
                'username': username,
                'google_data': None,
                'original_name': username,  # Store original name for logout
                'is_logged_in': False
            }
        print("--------------------------------")
        print("--------------------------------")
        print("--------------------------------")
        print("user_id --->", user_id)
        print("username ->", users[user_id]['username'])
        
        # Map this session to the user ID
        session_to_user_id[session_id] = user_id
        
        # Check if this is a reconnect after refresh
        is_refresh = user_id in recent_disconnects
        if is_refresh:
            del recent_disconnects[user_id]
        
        # Send user their user data
        emit('user_info', {
            'user_id': user_id,
            'username': users[user_id]['username'],
            'is_logged_in': users[user_id]['is_logged_in']
        })
        
        # Send chat history to the user
        emit('chat_history', message_service.get_messages())
        
        # Notify all users about the new connection
        if not is_refresh:
            system_message = message_service.add_message(
                'System', 
                f"{users[user_id]['username']} has joined the chat"
            )
            emit('new_message', system_message.to_dict(), broadcast=True)
    
    @socketio.on('authenticate')
    def handle_authentication(data):
        """Handle user authentication with Google"""
        session_id = request.sid
        
        if session_id not in session_to_user_id:
            return
            
        # Current user ID from the session
        current_user_id = session_to_user_id[session_id]
        google_id = data.get('id')
        
        if not google_id:
            return
            
        # Check if this Google ID is already associated with an existing user
        if google_id in google_id_to_user_id:
            # Get the previously associated user ID
            existing_user_id = google_id_to_user_id[google_id]
            
            # Check if the existing user ID is still valid
            if existing_user_id in users:
                # This is a returning Google user with a new temporary ID
                if current_user_id != existing_user_id:
                    # Transfer to the existing user ID
                    old_username = users[current_user_id]['username']
                    
                    # Update the session mapping
                    session_to_user_id[session_id] = existing_user_id
                    
                    # Clean up the temporary user
                    if current_user_id in users:
                        del users[current_user_id]
                    
                    # Set the current user ID to the existing one
                    current_user_id = existing_user_id
                    
                    # Notify about the identity change
                    system_message = message_service.add_message(
                        'System', 
                        f"Anonymous {old_username} is returning as {users[existing_user_id]['original_name']}"
                    )
                    emit('new_message', system_message.to_dict(), broadcast=True)
        else:
            # First time this Google ID is seen, associate it with the current user ID
            google_id_to_user_id[google_id] = current_user_id
        
        user = users[current_user_id]
        
        # Check if this is a new login or a refresh after login
        is_new_login = not user['is_logged_in']
        
        # Store Google data
        user['google_data'] = {
            'id': google_id,
            'name': data.get('name'),
            'isGoogleUser': True
        }
        
        old_username = user['username']
        new_username = data['name']
        
        # Update username if changed
        if old_username != new_username:
            user['username'] = new_username
            
            # Only send system message for new logins, not refreshes
            if is_new_login:
                system_message = message_service.add_message(
                    'System', 
                    f"Anonymous {old_username} logged in as {new_username}"
                )
                emit('new_message', system_message.to_dict(), broadcast=True)
        
        # Update login status
        user['is_logged_in'] = True
        
        # Send updated user info
        emit('user_info', {
            'user_id': current_user_id,
            'username': user['username'],
            'is_logged_in': True
        })
    
    @socketio.on('deauthenticate')
    def handle_deauthentication():
        """Handle user logout"""
        session_id = request.sid
        
        if session_id not in session_to_user_id:
            return
            
        user_id = session_to_user_id[session_id]
        user = users[user_id]
        
        # Only process if user was actually logged in
        if not user['is_logged_in']:
            return
        
        google_name = user['username']
        original_name = user['original_name']
    
        
        # Restore original name
        user['username'] = original_name
        user['is_logged_in'] = False
        user['google_data'] = None
        
        # Send system message for logout
        system_message = message_service.add_message(
            'System', 
            f"{google_name} logged out and now known as {original_name}"
        )
        emit('new_message', system_message.to_dict(), broadcast=True)
        
        # Send updated user info
        emit('user_info', {
            'user_id': user_id,
            'username': user['username'],
            'is_logged_in': False
        })
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        session_id = request.sid
        
        if session_id not in session_to_user_id:
            return
            
        user_id = session_to_user_id[session_id]
        
        # Add to recent disconnects with timestamp
        recent_disconnects[user_id] = datetime.utcnow()
        
        # Remove session mapping
        del session_to_user_id[session_id]
        
        # Schedule cleanup of disconnects after delay (5 seconds)
        socketio.start_background_task(
            check_disconnects, 
            socketio,
            user_id, 
            users[user_id]['username']
        )
    
    @socketio.on('send_message')
    def handle_message(data):
        """Handle new chat message"""
        session_id = request.sid
        content = data.get('message', '').strip()
        
        if not content or session_id not in session_to_user_id:
            return
            
        user_id = session_to_user_id[session_id]
        username = users[user_id]['username']
        
        message = message_service.add_message(username, content)
        
        # Broadcast the message to all connected clients
        emit('new_message', message.to_dict(), broadcast=True)

def check_disconnects(socketio, user_id, username):
    """Check if a disconnect is permanent after delay"""
    # Wait 5 seconds
    socketio.sleep(5)
    
    # If still in recent_disconnects and no active sessions, consider left
    if user_id in recent_disconnects:
        # Check if this user still has any active sessions
        has_active_sessions = False
        for active_user_id in session_to_user_id.values():
            if active_user_id == user_id:
                has_active_sessions = True
                break
        
        if not has_active_sessions:
            # Check if this user has a Google association before removing
            keep_user = False
            for google_id, mapped_user_id in google_id_to_user_id.items():
                if mapped_user_id == user_id:
                    keep_user = True
                    break
            
            # Send "left the chat" message
            system_message = message_service.add_message(
                'System', 
                f"{username} has left the chat"
            )
            socketio.emit('new_message', system_message.to_dict())
            
            # Only remove users that don't have Google account association
            if not keep_user and user_id in users and user_id not in session_to_user_id.values():
                del users[user_id]
        
        # Remove from recent disconnects
        del recent_disconnects[user_id]