from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)
from datetime import datetime

# --- NLP imports ---
from direct_summarizer import summarize_direct
from chunk_summarizer import summarize_chunked
from length_router import is_long_text
from model import tokenizer


# In-memory user storage
user_data_store = {}


# /start

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "سلام\n"
        "متن فارسی رو ارسال کن تا خلاصه‌اش کنم."
    )


# Receive text

async def receive_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    user_id = update.message.from_user.id

    context.user_data["current_text"] = text

    if user_id not in user_data_store:
        user_data_store[user_id] = []

    keyboard = [
        [
            InlineKeyboardButton("Short", callback_data="mode_short"),
            InlineKeyboardButton("Medium", callback_data="mode_medium"),
        ],
        [
            InlineKeyboardButton("Long", callback_data="mode_long"),
            InlineKeyboardButton("Auto", callback_data="mode_auto"),
        ],
    ]

    await update.message.reply_text(
        " Mode خلاصه‌سازی را انتخاب کن:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# Handle mode selection

async def handle_mode(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    mode = query.data.replace("mode_", "")
    text = context.user_data.get("current_text")

    if not text:
        await query.edit_message_text(" متنی برای خلاصه‌سازی یافت نشد.")
        return

    # --- Summarization ---
    if is_long_text(text, tokenizer):
        summary = summarize_chunked(text, mode=mode)
    else:
        summary = summarize_direct(text, mode=mode)

    # --- Save history ---
    user_id = query.from_user.id
    timestamp = datetime.now().strftime("%H:%M | %Y-%m-%d")

    user_data_store[user_id].append({
        "text": text,
        "summary": summary,
        "mode": mode,
        "time": timestamp
    })

    # --- Save last summary for navigation ---
    context.user_data["last_summary"] = summary
    context.user_data["last_mode"] = mode

    keyboard = [
        [InlineKeyboardButton("🔁 تغییر Mode", callback_data="change_mode")],
        [InlineKeyboardButton("🕘 تاریخچه خلاصه‌ها", callback_data="history")],
        [InlineKeyboardButton("✍️ خلاصه جدید", callback_data="new")],
    ]

    await query.edit_message_text(
        f"✅ خلاصه ({mode}):\n\n{summary}",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# Change mode menu

async def change_mode(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    keyboard = [
        [
            InlineKeyboardButton("Short", callback_data="mode_short"),
            InlineKeyboardButton("Medium", callback_data="mode_medium"),
        ],
        [
            InlineKeyboardButton("Long", callback_data="mode_long"),
            InlineKeyboardButton("Auto", callback_data="mode_auto"),
        ],
        [
            InlineKeyboardButton("🔙 بازگشت", callback_data="back_to_summary"),
        ],
    ]

    await query.edit_message_text(
        " Mode جدید را انتخاب کن:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# Back to last summary

async def back_to_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    summary = context.user_data.get("last_summary")
    mode = context.user_data.get("last_mode")

    keyboard = [
        [InlineKeyboardButton("🔁 تغییر Mode", callback_data="change_mode")],
        [InlineKeyboardButton("🕘 تاریخچه خلاصه‌ها", callback_data="history")],
        [InlineKeyboardButton("✍️ خلاصه جدید", callback_data="new")],
    ]

    await query.edit_message_text(
        f"✅ خلاصه ({mode}):\n\n{summary}",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# Show history

async def show_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    history = user_data_store.get(user_id, [])

    if not history:
        await query.edit_message_text("🕘 تاریخچه‌ای وجود ندارد.")
        return

    keyboard = []
    for i, item in enumerate(history):
        keyboard.append([
            InlineKeyboardButton(
                f"{item['time']} | {item['mode']}",
                callback_data=f"hist_{i}",
            )
        ])

    keyboard.append([
        InlineKeyboardButton("🔙 بازگشت", callback_data="back_to_summary")
    ])

    await query.edit_message_text(
        "🕘 تاریخچه خلاصه‌ها:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# Show history item

async def show_history_item(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    index = int(query.data.replace("hist_", ""))

    item = user_data_store[user_id][index]

    context.user_data["current_text"] = item["text"]
    context.user_data["last_summary"] = item["summary"]
    context.user_data["last_mode"] = item["mode"]

    keyboard = [
        [InlineKeyboardButton("🔁 تغییر Mode", callback_data="change_mode")],
        [InlineKeyboardButton("🔙 بازگشت", callback_data="history")],
    ]

    await query.edit_message_text(
        f"📌 متن اصلی:\n{item['text']}\n\n"
        f"✂️ خلاصه ({item['mode']}):\n{item['summary']}",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# New summarization

async def new_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    context.user_data.clear()

    await query.edit_message_text(
        " لطفاً متن جدید را ارسال کن."
    )


# Main

def main():
    app = ApplicationBuilder().token("YOUR_TELEGRAM_BOT_TOKEN").build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, receive_text))

    app.add_handler(CallbackQueryHandler(handle_mode, pattern="^mode_"))
    app.add_handler(CallbackQueryHandler(change_mode, pattern="^change_mode$"))
    app.add_handler(CallbackQueryHandler(
        back_to_summary, pattern="^back_to_summary$"))

    app.add_handler(CallbackQueryHandler(show_history, pattern="^history$"))
    app.add_handler(CallbackQueryHandler(show_history_item, pattern="^hist_"))
    app.add_handler(CallbackQueryHandler(new_summary, pattern="^new$"))

    print("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
