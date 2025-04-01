from flask import request
from flask_socketio import emit
from services.message_service import message_service
from utils.name_generator import generate_random_name

# Store active users with their session IDs
active_users = {}

def register_socket_events(socketio):
    """Register all socket.io event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle new client connection"""
        session_id = request.sid
        username = generate_random_name()
        active_users[session_id] = username
        
        # Send user their assigned username
        emit('user_info', {'username': username})
        
        # Send chat history to the new user
        emit('chat_history', message_service.get_messages())
        
        # Notify all users about the new user
        system_message = message_service.add_message('System', f'{username} has joined the chat')
        emit('new_message', system_message.to_dict(), broadcast=True)
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        session_id = request.sid
        if session_id in active_users:
            username = active_users[session_id]
            system_message = message_service.add_message('System', f'{username} has left the chat')
            emit('new_message', system_message.to_dict(), broadcast=True)
            del active_users[session_id]
    
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

