import random

def generate_random_name():
    """Generate a random username for new users"""
    adjectives = [
        "Happy", "Sleepy", "Grumpy", "Sneezy", "Dopey", "Bashful", "Doc",
        "Clever", "Swift", "Brave", "Bright", "Calm", "Eager", "Gentle",
        "Kind", "Lively", "Polite", "Proud", "Silly", "Witty", "Zealous"
    ]
    
    nouns = [
        "Panda", "Tiger", "Eagle", "Dolphin", "Wolf", "Fox", "Bear",
        "Lion", "Rabbit", "Koala", "Penguin", "Owl", "Hawk", "Deer",
        "Squirrel", "Raccoon", "Elephant", "Giraffe", "Monkey", "Zebra"
    ]
    
    random_number = random.randint(1, 999)
    
    return f"{random.choice(adjectives)}{random.choice(nouns)}{random_number}"
