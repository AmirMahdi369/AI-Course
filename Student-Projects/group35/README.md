# ☕ AI Coffee Barista - Smart Coffee Recommendation System

- Islamic Azad University, Central Tehran Branch
- Course Name: Artificial Intelligence course
- Professor's Name: Dr Hajiesmaeili
- Student Name: Mohammad Hesam Nasiri 
- Student number: 40110130117467
- Telegram ID: HesamNasirii


An intelligent coffee recommendation system powered by AI that suggests the perfect coffee based on your mood, taste preferences, and current state. Built with Django and OpenRouter API (GPT-4o-mini).

![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Django](https://img.shields.io/badge/django-4.2+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- 🤖 **AI-Powered Recommendations**: Get personalized coffee suggestions based on:
  - Your current mood
  - Taste preferences (bitter, mild, balanced, special)
  - Time since last coffee
  - Additional custom preferences
  
- 💬 **Interactive Chat**: Continue the conversation with the AI barista after receiving your initial recommendation

- 🎨 **Beautiful Persian UI**: Modern, responsive design with RTL support

- 📋 **Customizable Menu**: Easy-to-edit default menu items with image support

- 📊 **Analytics Ready**: Stores user preferences for insights and improvements

- 🌐 **No Database Required**: Works with static menu items (database optional)

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- pip
- OpenRouter API key (free tier available)

### Installation


1. **Install dependencies**
```bash
pip install -r requirements.txt
```

2. **Set up environment variables**

Create a `.env` file in the project root:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your-api-key-here
SECRET_KEY=your-django-secret-key
DEBUG=True
```

Get your free OpenRouter API key at: https://openrouter.ai/

3. **Run migrations**
```bash
python manage.py makemigrations
python manage.py migrate
```

4. **Create admin user (optional)**
```bash
python manage.py createsuperuser
```

5. **Run the development server**
```bash
python manage.py runserver
```

6. **Open your browser**
```
http://localhost:8000/
```

## 📁 Project Structure

```
ai-coffee-barista/
├── app_name/
│   ├── templates/
│   │   ├── menu.html              # Main menu page
│   │   └── ai_recommendation.html # AI recommendation & chat page
│   ├── static/
│   │   └── images/
│   │       └── menu/              # Place your custom menu images here
│   ├── models.py                  # Database models
│   ├── views.py                   # View logic with DEFAULT_MENU_ITEMS
│   ├── forms.py                   # User input forms
│   ├── agent.py                   # AI integration logic
│   ├── urls.py                    # URL routing
│   └── admin.py                   # Admin panel configuration
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment variables template
└── README.md                      # This file
```

## 🎨 Customizing Menu Items

### Option 1: Using Default Static Menu (Recommended)

Edit `views.py` and modify the `DEFAULT_MENU_ITEMS` list:

```python
DEFAULT_MENU_ITEMS = [
    {
        'name': 'اسپرسو',  # Espresso
        'description': 'A pure shot of arabica coffee...',
        'emoji': '☕',
        'image': None,  # Or 'espresso.jpg' if you add an image
    },
    # Add more items...
]
```

### Option 2: Adding Custom Images

1. Place your images in: `static/images/menu/`
2. Update the `'image'` field in `DEFAULT_MENU_ITEMS`:
   ```python
   'image': 'espresso.jpg',  # Your image filename
   ```

### Option 3: Using Database (Advanced)

1. Add menu items through Django admin panel: `/admin`
2. Modify `MenuView` in `views.py` to fetch from database instead of `DEFAULT_MENU_ITEMS`

## 🔧 Configuration

### Django Settings

Add to your `settings.py`:

```python
INSTALLED_APPS = [
    # ...
    'your_app_name',
]

# For image uploads (if using database menu)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
```

### URL Configuration

In your project's main `urls.py`:

```python
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('your_app_name.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

## 🤖 How It Works

1. **User Input**: User fills out a form with their mood, taste preference, and last coffee time
2. **Prompt Building**: System constructs an optimized prompt for the AI
3. **AI Processing**: OpenRouter API (GPT-4o-mini) generates a personalized recommendation
4. **Chat Continuation**: User can continue chatting with the AI for follow-up questions
5. **Context Preservation**: Full conversation history maintained in session

## 📊 API Usage

The system uses OpenRouter API with these endpoints:

- **Model**: `gpt-4o-mini` (free tier)
- **Temperature**: 0.8 (creative recommendations)
- **Max Tokens**: 500 (concise responses)

## 🔒 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | Yes |
| `SECRET_KEY` | Django secret key | Yes |
| `DEBUG` | Debug mode (True/False) | No |
