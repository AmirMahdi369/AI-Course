"""
Django Forms for Coffee AI Recommendation System
Handles user input for coffee preferences and mood
"""

from django import forms


class CoffeeAgentForm(forms.Form):
    """
    Form for collecting user preferences for AI coffee recommendation
    Fields: mood, taste preference, last coffee time, additional description
    """
    
    # User's current mood/feeling
    mood = forms.CharField(
        label="حال و احوال امروزت چطوره؟",  # "How are you feeling today?"
        max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': 'مثلا: خسته‌ام، شاد، استرس دارم، آرومم...'  # "e.g., tired, happy, stressed, calm..."
        }),
        help_text="حالتت رو با چند کلمه توضیح بده"  # "Describe your mood in a few words"
    )
    
    # Taste preference selection
    taste = forms.ChoiceField(
        label="ذائقه‌ات چیه؟",  # "What's your taste preference?"
        choices=[
            ('', 'انتخاب کنید...'),  # "Select..."
            ('تلخ', '☕ تلخ و قوی'),  # "Bitter and strong"
            ('ملایم', '🥛 ملایم و شیرین'),  # "Mild and sweet"
            ('متعادل', '⚖️ متعادل'),  # "Balanced"
            ('خاص', '✨ یه چیز خاص')  # "Something special"
        ],
        widget=forms.Select(attrs={
            'style': 'font-size: 1rem;'
        })
    )
    
    # Last coffee consumption time
    last_coffee = forms.CharField(
        label="آخرین بار کی قهوه خوردی؟",  # "When did you last have coffee?"
        max_length=100,
        widget=forms.TextInput(attrs={
            'placeholder': 'مثلا: صبح، دیروز، یه هفته پیش...'  # "e.g., morning, yesterday, a week ago..."
        })
    )
    
    # Additional optional description
    description = forms.CharField(
        label="توضیحات اضافی (اختیاری)",  # "Additional details (optional)"
        required=False,
        widget=forms.Textarea(attrs={
            'rows': 3,
            'placeholder': 'اگر خواسته خاصی داری یا چیزی میخوای بگی اینجا بنویس...'  # "If you have any special requests..."
        })
    )
    
    def clean_mood(self):
        """
        Validate mood field - must be at least 2 characters
        """
        mood = self.cleaned_data.get('mood', '')
        if len(mood.strip()) < 2:
            raise forms.ValidationError('لطفاً حالتت رو بیشتر توضیح بده')  # "Please describe your mood more"
        return mood