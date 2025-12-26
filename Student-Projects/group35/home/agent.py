"""
AI Agent Module for Coffee Recommendations
Handles communication with OpenRouter API (GPT-4o-mini)
Builds prompts and manages conversation context
"""

import os
import requests


def ask_ai(prompt):
    """
    Send a single prompt to AI and get response
    
    Args:
        prompt (str): The prompt to send to AI
        
    Returns:
        str: AI's response text
    """
    # Get API key from environment variable
    OPENROUTER_API_KEY = "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"
    
    # Check if API key is configured
    if not OPENROUTER_API_KEY:
        return "⚠️ کلید API تنظیم نشده است. لطفاً متغیر محیطی OPENROUTER_API_KEY را تنظیم کنید."
        # "⚠️ API key not configured. Please set OPENROUTER_API_KEY environment variable."
    
    # OpenRouter API endpoint
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    # Request headers
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Request payload with system prompt and user message
    payload = {
        "model": "gpt-4o-mini",  # Using free tier model
        "messages": [
            {
                "role": "system", 
                "content": """تو یک باریستای حرفه‌ای و دوستانه هستی که به فارسی صحبت می‌کنی.
                
وظیفه‌ات اینه که:
1. بر اساس حال و احوال مشتری، بهترین قهوه رو پیشنهاد بدی
2. دلیلش رو به زبون ساده توضیح بدی
3. لحن دوستانه و صمیمی داشته باشی
4. اگر نیاز بود، نکاتی درباره طرز تهیه یا زمان مصرف بگی

همیشه پاسخت رو با ایموجی مناسب شروع کن و حداکثر 4-5 جمله باشه."""
                # System prompt: "You are a professional and friendly barista who speaks Persian.
                # Your job: 1) Recommend best coffee based on customer's mood
                # 2) Explain reason simply, 3) Use friendly tone
                # 4) Provide preparation tips if needed
                # Always start with emoji, max 4-5 sentences."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.8,  # Creativity level
        "max_tokens": 500     # Maximum response length
    }
    
    try:
        # Send POST request to OpenRouter
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        # Extract and return AI response
        return response.json()["choices"][0]["message"]["content"]
        
    except requests.exceptions.RequestException as e:
        # Handle request/network errors
        return f"❌ خطا در ارتباط با سرویس هوش مصنوعی: {str(e)}"
        # "❌ Error connecting to AI service"
        
    except Exception as e:
        # Handle unexpected errors
        return f"❌ خطای غیرمنتظره: {str(e)}"
        # "❌ Unexpected error"


def build_prompt(data):
    """
    Build a prompt from user form data
    
    Args:
        data (dict): Form cleaned data containing mood, taste, last_coffee, description
        
    Returns:
        str: Formatted prompt for AI
    """
    # Start with basic information
    prompt = f"""یک مشتری اومده و این اطلاعات رو داده:

🧠 حال و احوال: {data['mood']}
👅 ذائقه: {data['taste']}
⏰ آخرین قهوه: {data['last_coffee']}"""
    # "A customer came with this information:
    # Mood: ..., Taste: ..., Last coffee: ..."
    
    # Add optional description if provided
    if data.get('description'):
        prompt += f"\n💬 توضیحات اضافی: {data['description']}"
        # "Additional details: ..."
    
    # Add recommendation guidelines
    prompt += """

حالا بهترین قهوه رو با توجه به این موارد بهش پیشنهاد بده:
- اگه خسته است → قهوه قوی‌تر
- اگه استرس داره → کافئین کمتر یا دکف
- اگه صبحه → اسپرسو یا کاپوچینو
- اگه عصره → قهوه ملایم‌تر
- اگه دیر قهوه خورده → قهوه قوی‌تر

پاسخت باید خیلی دوستانه، کوتاه (4-5 جمله) و با ایموجی باشه! 😊"""
    # "Now recommend the best coffee considering:
    # - If tired → stronger coffee
    # - If stressed → less caffeine or decaf
    # - If morning → espresso or cappuccino
    # - If afternoon → milder coffee
    # - If long time since last coffee → stronger coffee
    # Response should be very friendly, short (4-5 sentences) with emojis! 😊"
    
    return prompt


def ask_ai_with_history(conversation_history):
    """
    Send full conversation history to AI for contextual responses
    Used for chat continuation after initial recommendation
    
    Args:
        conversation_history (list): List of message dicts with 'role' and 'content'
        
    Returns:
        str: AI's contextual response
    """
    # Get API key
    OPENROUTER_API_KEY = "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"
    
    # Check if API key is configured
    if not OPENROUTER_API_KEY:
        return "⚠️ کلید API تنظیم نشده است."
        # "⚠️ API key not configured."
    
    # OpenRouter API endpoint
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    # Request headers
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Request payload with full conversation history
    payload = {
        "model": "gpt-4o-mini",
        "messages": conversation_history,  # Include all previous messages
        "temperature": 0.7,  # Slightly lower for more consistent responses
        "max_tokens": 400
    }
    
    try:
        # Send request with conversation context
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        # Return AI's response
        return response.json()["choices"][0]["message"]["content"]
        
    except Exception as e:
        # Handle errors
        return f"❌ خطا: {str(e)}"
        # "❌ Error"