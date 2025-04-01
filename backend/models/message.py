from datetime import datetime

class Message:
    """Message model for the chat application"""
    
    def __init__(self, username, content):
        self.username = username
        self.content = content
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self):
        """Convert message to dictionary for JSON serialization"""
        return {
            'username': self.username,
            'content': self.content,
            'timestamp': self.timestamp
        }
