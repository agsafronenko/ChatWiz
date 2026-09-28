from datetime import datetime

class Message:
    """Message model for the chat application"""

    def __init__(self, room_name, username, content):
        self.room_name = room_name 
        self.username = username
        self.content = content
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self):
        """Convert message to dictionary for JSON serialization"""
        return {
            'room_name': self.room_name,
            'username': self.username,
            'content': self.content,
            'timestamp': self.timestamp
        }