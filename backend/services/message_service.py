# --- START OF FILE services/message_service.py ---

from models.message import Message
from config import Config
from collections import defaultdict, deque

class MessageService:
    """Service to handle message storage and retrieval per room"""

    def __init__(self, max_messages=Config.MAX_MESSAGES):
        self.messages = defaultdict(lambda: deque(maxlen=max_messages))
        self.max_messages = max_messages

    # No change needed in signature here, just how Message is called
    def add_message(self, room_name, username, content):
        """Add a new message to the specific room's chat history"""
        if not room_name:
            print("Warning: Attempted to add message with no room name.")
            return None

        # Pass room_name when creating the Message object
        message = Message(room_name, username, content)

        self.messages[room_name].append(message)

        return message

    def get_messages(self, room_name):
        """Get all messages for a specific room as dictionaries"""
        if room_name not in self.messages:
            return []
        return [message.to_dict() for message in self.messages[room_name]]

    def remove_room_history(self, room_name):
        """Remove message history for a room when it's deleted"""
        if room_name in self.messages:
            del self.messages[room_name]
            print(f"Removed message history for room: {room_name}")


message_service = MessageService()
# --- END OF FILE services/message_service.py ---