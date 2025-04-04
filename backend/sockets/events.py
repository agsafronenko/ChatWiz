from flask import request
from flask_socketio import emit
from services.message_service import message_service
from utils.name_generator import generate_random_name

# Store active users with their session IDs
active_users = {}
authenticated_users = {}

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
            # Store authenticated user info
            authenticated_users[session_id] = {
                'id': data['id'],
                'name': data['name'],
                'isGoogleUser': data.get('isGoogleUser', False)
            }
            
            old_username = active_users.get(session_id)
            new_username = data['name']
            active_users[session_id] = new_username
            
            # Notify all users about the username change
            if old_username and old_username != new_username:
                system_message = message_service.add_message(
                    'System', 
                    f'{old_username} is now known as {new_username}'
                )
                emit('new_message', system_message.to_dict(), broadcast=True)
    
    @socketio.on('deauthenticate')
    def handle_deauthentication():
        """Handle user deauthentication"""
        session_id = request.sid
        
        if session_id in authenticated_users:
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
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        session_id = request.sid
        if session_id in active_users:
            username = active_users[session_id]
            
            # Only add the "left the chat" message if it wasn't a page refresh
            # We consider it a disconnect only if the user doesn't reconnect within a short time
            # (This is handled client-side by including the username in the reconnect)
            system_message = message_service.add_message('System', f'{username} has left the chat')
            emit('new_message', system_message.to_dict(), broadcast=True)
            
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