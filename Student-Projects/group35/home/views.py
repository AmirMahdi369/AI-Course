"""
Django Views for Coffee AI Recommendation System
Handles menu display, AI recommendations, and chat functionality
"""

from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
from django.templatetags.static import static
from .forms import CoffeeAgentForm
from .models import CoffeeMood
from .agent import ask_ai, build_prompt, ask_ai_with_history
import json


# Default menu items (displayed when database is empty or not used)
# You can add your custom images in: static/images/menu/your_image.jpg
# Then update the 'image' field below with the filename
DEFAULT_MENU_ITEMS = [
    {
        'name': 'اسپرسو',  # Espresso
        'description': 'یک شات تمیز و خالص از بهترین دانه‌های قهوه عربیکا. مناسب برای شروع روز با انرژی کامل.',
        'emoji': '☕',
        'image': 'Espresso_Freddo.jpeg',  # Set to 'espresso.jpg' if you add an image to static/images/menu/
    },
    {
        'name': 'کاپوچینو',  # Cappuccino
        'description': 'ترکیب عالی از اسپرسو، شیر داغ و کف شیر نرم. طعمی متعادل بین تلخی و شیرینی.',
        'emoji': '🥤',
        'image': 'Discover_the_perfect_balance_of_sweetness_and_bold.jpeg',  # Set to 'cappuccino.jpg' if you add an image
    },
    {
        'name': 'لاته',  # Latte
        'description': 'قهوه‌ای ملایم و شیری با لایه‌ای نازک از کف. برای کسانی که طعم ملایم‌تر را ترجیح می‌دهند.',
        'emoji': '🍵',
        'image': None,
    },
    {
        'name': 'آیس لاته',  # Iced Latte
        'description': 'نسخه سرد و خنک لاته با یخ. ایده‌آل برای روزهای گرم تابستان.',
        'emoji': '🧊',
        'image': None,
    },
    {
        'name': 'موکا',  # Mocha
        'description': 'ترکیب لذیذ قهوه و شکلات با خامه. برای عاشقان شیرینی و شکلات.',
        'emoji': '🍫',
        'image': 'Iced_Caramel_Macchiato.jpeg',
    },
    {
        'name': 'آمریکانو',  # Americano
        'description': 'اسپرسو رقیق شده با آب داغ. برای کسانی که طعم قوی قهوه را دوست دارند اما حجم بیشتری می‌خواهند.',
        'emoji': '☕',
        'image': None,
    },
]


class MenuView(View):
    """
    Main menu page view
    Displays cafe menu items (from default list or database)
    """
    
    def get(self, request):
        """
        Handle GET request for menu page
        Processes menu items and adds image URLs
        """
        # Process menu items and add image URLs
        menu_items = []
        for item in DEFAULT_MENU_ITEMS:
            menu_item = {
                'name': item['name'],
                'description': item['description'],
                'emoji': item['emoji'],
                'image_url': None
            }
            
            # If image filename is provided, generate static URL
            if item.get('image'):
                menu_item['image_url'] = static(f'images/{item["image"]}')
            
            menu_items.append(menu_item)
        
        return render(request, 'menu.html', {
            'menu_items': menu_items
        })


class AIRecommendationView(View):
    """
    AI Coffee Recommendation page
    Handles form display, submission, and AI responses
    """
    
    def get(self, request):
        """
        Display the recommendation form
        """
        form = CoffeeAgentForm()
        return render(request, 'ai_recommendation.html', {'form': form})
    
    def post(self, request):
        """
        Process form submission and get AI recommendation
        Saves conversation to database and session
        """
        form = CoffeeAgentForm(request.POST)
        
        if form.is_valid():
            # Save user input to database
            coffee_mood = CoffeeMood.objects.create(
                mood=form.cleaned_data['mood'],
                time_of_day='',  # Can be added if needed
                taste=form.cleaned_data['taste'],
                last_coffee=form.cleaned_data['last_coffee'],
                description=form.cleaned_data.get('description', '')
            )
            
            # Build prompt and get AI response
            prompt = build_prompt(form.cleaned_data)
            result = ask_ai(prompt)
            
            # Save conversation history to session for chat continuation
            request.session['conversation_history'] = [
                {"role": "system", "content": "تو یک باریستای حرفهای هستی"},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": result}
            ]
            request.session['coffee_mood_id'] = coffee_mood.id
            
            # Return form with result and enable chat
            return render(request, 'ai_recommendation.html', {
                'form': form,
                'result': result,
                'show_chat': True
            })
        
        # Return form with validation errors
        return render(request, 'ai_recommendation.html', {'form': form})


class ChatContinueView(View):
    """
    Handle continued conversation with AI
    AJAX endpoint for chat messages
    """
    
    def post(self, request):
        """
        Process chat message and return AI response
        Uses conversation history from session
        """
        try:
            # Parse JSON request body
            data = json.loads(request.body)
            user_message = data.get('message', '')
            
            # Get conversation history from session
            conversation_history = request.session.get('conversation_history', [])
            
            # Validate that a conversation exists
            if not conversation_history:
                return JsonResponse({
                    'error': 'لطفاً ابتدا از صفحه پیشنهاد استفاده کنید',
                    'success': False
                }, status=400)
            
            # Add new user message to history
            conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            # Get AI response with full conversation context
            ai_response = ask_ai_with_history(conversation_history)
            
            # Add AI response to history
            conversation_history.append({
                "role": "assistant",
                "content": ai_response
            })
            
            # Save updated history to session
            request.session['conversation_history'] = conversation_history
            
            # Return successful response
            return JsonResponse({
                'response': ai_response,
                'success': True
            })
            
        except json.JSONDecodeError:
            return JsonResponse({
                'error': 'Invalid JSON format',
                'success': False
            }, status=400)
            
        except Exception as e:
            # Log error and return error response
            print(f"Error in chat continuation: {str(e)}")
            return JsonResponse({
                'error': str(e),
                'success': False
            }, status=500)