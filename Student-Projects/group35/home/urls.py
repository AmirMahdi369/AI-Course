"""
URL Configuration for Coffee AI Recommendation App
Maps URLs to their corresponding views
"""

from django.urls import path
from .views import MenuView, AIRecommendationView, ChatContinueView

urlpatterns = [
    # Main menu page - shows cafe menu items
    path('', MenuView.as_view(), name='menu'),
    
    # AI recommendation form and results page
    path('ai-recommendation/', AIRecommendationView.as_view(), name='ai_recommendation'),
    
    # AJAX endpoint for chat continuation
    path('chat-continue/', ChatContinueView.as_view(), name='chat_continue'),
]