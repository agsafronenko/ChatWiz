from models.message import Message
from config import Config

class MessageService:
    """Service to handle message storage and retrieval"""
    
    def __init__(self, max_messages=Config.MAX_MESSAGES):
        self.messages = []
        self.max_messages = max_messages
    
    def add_message(self, username, content):
        """Add a new message to the chat history"""
        message = Message(username, content)
        
        # Add message to the list
        self.messages.append(message)
        
        # Trim list if it exceeds max_messages
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
            
        return message
    
    def get_messages(self):
        """Get all messages as dictionaries"""
        return [message.to_dict() for message in self.messages]

# Create a global message service instance
message_service = MessageService()
