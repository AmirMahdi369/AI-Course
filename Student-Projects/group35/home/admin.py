"""
Django Admin Configuration for Coffee AI App
Registers models for easy management in admin panel
"""

from django.contrib import admin
from .models import Menu, CoffeeMood


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    """
    Admin interface for Menu model
    Allows managing cafe menu items
    """
    # Display these fields in list view
    list_display = ['item', 'description']
    
    # Enable search by these fields
    search_fields = ['item', 'description']
    
    # Number of items per page
    list_per_page = 20


@admin.register(CoffeeMood)
class CoffeeMoodAdmin(admin.ModelAdmin):
    """
    Admin interface for CoffeeMood model
    Stores user preferences and AI recommendation history
    """
    # Display these fields in list view
    list_display = ['mood', 'taste', 'last_coffee', 'created_at']
    
    # Add filters for these fields in sidebar
    list_filter = ['taste', 'created_at']
    
    # Enable search by these fields
    search_fields = ['mood', 'description']
    
    # Make created_at read-only (auto-generated)
    readonly_fields = ['created_at']
    
    # Number of items per page
    list_per_page = 50
    
    # Organize fields into sections
    fieldsets = (
        ('اطلاعات مشتری', {  # "Customer Information"
            'fields': ('mood', 'taste', 'last_coffee')
        }),
        ('جزئیات', {  # "Details"
            'fields': ('description', 'time_of_day', 'created_at')
        }),
    )