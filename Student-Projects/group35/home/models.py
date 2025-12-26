"""
Django Models for Coffee AI Recommendation System
Defines database structure for menu items and user preferences
"""

from django.db import models


class CoffeeMood(models.Model):
    """
    Stores user mood/preferences and their coffee recommendation request
    Used for analytics and improving recommendations
    """
    # User's current mood/feeling
    mood = models.CharField(max_length=50, verbose_name="حال و احوال")
    
    # Time of day (morning, afternoon, evening, etc.)
    time_of_day = models.CharField(max_length=50, verbose_name="زمان روز")
    
    # Taste preference (bitter, mild, balanced, special)
    taste = models.CharField(max_length=50, verbose_name="ذائقه")
    
    # When they last had coffee
    last_coffee = models.CharField(max_length=50, verbose_name="آخرین قهوه")
    
    # Additional user description/preferences
    description = models.CharField(max_length=255, verbose_name="توضیحات")
    
    # Timestamp of when the record was created
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    
    class Meta:
        verbose_name = "درخواست پیشنهاد قهوه"  # "Coffee Recommendation Request"
        verbose_name_plural = "درخواست‌های پیشنهاد قهوه"  # "Coffee Recommendation Requests"
        ordering = ['-created_at']  # Most recent first
    
    def __str__(self):
        return f"{self.mood} - {self.taste} ({self.created_at.strftime('%Y-%m-%d')})"


class Menu(models.Model):
    """
    Cafe menu items (optional - can use DEFAULT_MENU_ITEMS in views.py instead)
    Allows dynamic menu management through admin panel
    """
    # Name of the coffee item
    item = models.CharField(max_length=255, verbose_name="نام آیتم")
    
    # Image of the coffee item
    image = models.ImageField(upload_to='menu/', verbose_name="تصویر")
    
    # Description of the coffee item
    description = models.TextField(verbose_name="توضیحات")
    
    # Optional: Price field
    # price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="قیمت", null=True, blank=True)
    
    class Meta:
        verbose_name = "آیتم منو"  # "Menu Item"
        verbose_name_plural = "آیتم‌های منو"  # "Menu Items"
    
    def __str__(self):
        return self.item