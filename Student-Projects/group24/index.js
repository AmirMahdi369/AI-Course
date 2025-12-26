import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import analyzeImage from './imageAnalyze.js';
import { apiChat, initializeGuessingGame } from './apiChat.js';

dotenv.config();

function getENV(envName){
  if(process.env[envName] && process.env[envName].length === 0){
    console.error(`Error loading env variable ${envName}`)
    process.exit(1)
  }
  return process.env[envName]
}

// Configuration
const BOT_TOKEN = getENV("BOT_TOKEN");
const bot = new Telegraf(BOT_TOKEN);
const activeGames = {};
const sendAnnotated = true;

// Timeout Configuration
const TIMEOUT_NAMING = 1 * 60 * 1000;
const TIMEOUT_QUESTION = 2 * 60 * 1000;
const TIMEOUT_GUESS_VERIFY = 2 * 60 * 1000;
const TIMEOUT_TOTAL_GAME = TIMEOUT_NAMING * 10 + TIMEOUT_QUESTION * parseInt(process.env.MAX_QUESTIONS || '20') + TIMEOUT_GUESS_VERIFY;

// Utility Functions
function formatAnalysisSummary(person) {
  let text = 'Detailed Analysis Summary:\n\n';
  text += '┌─ Basic Information\n';
  text += `│  • Age: ~${Math.round(person.face.age)} years old\n`;
  text += `│  • Gender: ${person.face.gender} (${person.face.genderScore}% confidence)\n`;
  text += '│\n';
  text += '├─ Emotions\n';
  if (person.face.primaryEmotion) {
    text += `│  • Primary Emotion: ${person.face.primaryEmotion.emotion} (${person.face.primaryEmotion.score}% confidence)\n`;
  }
  if (person.face.emotion && person.face.emotion.length > 0) {
    text += '│  • All Emotions:\n';
    person.face.emotion.forEach(emo => {
      text += `│    - ${emo.emotion}: ${emo.score}%\n`;
    });
  }
  text += '│\n';
  text += '├─ Eye Details\n';
  if (person.face.eyeColor && person.face.eyeColor.colorName) {
    text += `│  • Eye Color: ${person.face.eyeColor.colorName} (${person.face.eyeColor.simpleColorName})\n`;
    text += `│    Category: ${person.face.eyeColor.color}\n`;
    if (person.face.eyeColor.confidence) {
      text += `│    Confidence: ${person.face.eyeColor.confidence}%\n`;
    }
  }
  if (person.face.eyes) {
    let eyeState = '';
    if (person.face.eyes.bothOpen) {
      eyeState = 'Both Open';
    } else if (person.face.eyes.left === 'closed' && person.face.eyes.right === 'closed') {
      eyeState = 'Both Closed';
    } else if (person.face.eyes.blinking) {
      eyeState = 'Blinking';
    } else {
      eyeState = `Left: ${person.face.eyes.left}, Right: ${person.face.eyes.right}`;
    }
    text += `│  • Eye State: ${eyeState}\n`;
  }
  text += '│\n';
  text += '├─ Hair Details\n';
  if (person.face.hairColor && person.face.hairColor.colorName) {
    text += `│  • Hair Color: ${person.face.hairColor.colorName} (${person.face.hairColor.simpleColorName})\n`;
    text += `│    Category: ${person.face.hairColor.color}\n`;
    if (person.face.hairColor.confidence) {
      text += `│    Confidence: ${person.face.hairColor.confidence}%\n`;
    }
  }
  text += '│\n';
  text += '├─ Skin Details\n';
  if (person.face.skinTone) {
    text += `│  • Skin Tone: ${person.face.skinTone.tone}\n`;
    if (person.face.skinTone.undertone) {
      text += `│    Undertone: ${person.face.skinTone.undertone}\n`;
    }
    if (person.face.skinTone.fitzpatrick) {
      text += `│    Fitzpatrick: ${person.face.skinTone.fitzpatrick}\n`;
    }
    if (person.face.skinTone.confidence) {
      text += `│    Confidence: ${person.face.skinTone.confidence}%\n`;
    }
    if (person.face.skinTone.colorName) {
      text += `│  • Skin Color: ${person.face.skinTone.colorName} (${person.face.skinTone.simpleColorName})\n`;
    }
  }
  text += '│\n';
  text += '├─ Mouth State\n';
  if (person.face.mouth) {
    const mouthState = person.face.mouth.openPercent !== null
      ? `${person.face.mouth.state} (${person.face.mouth.openPercent}%)`
      : person.face.mouth.state;
    text += `│  • Mouth: ${mouthState}\n`;
  }
  text += '│\n';
  text += '├─ Direction & Position\n';
  if (person.face.headDirection) {
    text += `│  • Head Direction: ${person.face.headDirection.direction}\n`;
  }
  if (person.face.gazeDirection) {
    text += `│  • Gaze Direction: ${person.face.gazeDirection.direction}\n`;
  }
  if (person.face.distance) {
    text += `│  • Distance: ${person.face.distance.meters}m (${person.face.distance.description})\n`;
  }
  text += '└─────────────';
  return text;
}

function isGameValid(userId) {
  const game = activeGames[userId];
  if (!game) return false;

  const now = Date.now();
  const timeSinceLastResponse = now - game.lastResponseTime;
  const timeSinceStart = now - game.gameStartTime;

  if (timeSinceStart > TIMEOUT_TOTAL_GAME) {
    return false;
  }

  if (game.state === 'naming' && timeSinceLastResponse > TIMEOUT_NAMING) {
    return false;
  }
  if (game.state === 'playing' && timeSinceLastResponse > TIMEOUT_QUESTION) {
    return false;
  }
  if (game.state === 'guessVerify' && timeSinceLastResponse > TIMEOUT_GUESS_VERIFY) {
    return false;
  }

  return true;
}

// Bot Handlers
bot.start((ctx) => {
  ctx.reply(
    'Welcome to Person Guesser Game!\n\n' +
    'I analyze images with multiple people and play a guessing game with you!\n\n' +
    'How to play:\n' +
    '1. Upload an image with at least 2 people (JPG or PNG)\n' +
    '2. I will analyze the faces and ask you to name them\n' +
    '3. Think of one person and I will try to guess who!\n\n' +
    'Commands:\n' +
    '/cancel - Cancel current game\n\n' +
    'Upload an image to get started!'
  );
});

bot.command('cancel', (ctx) => {
  const userId = ctx.from.id;
  if (activeGames[userId]) {
    delete activeGames[userId];
    ctx.reply('Game cancelled. You can start a new game by uploading an image.');
  } else {
    ctx.reply('No active game found.');
  }
});

bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    if (activeGames[userId]) {
      await ctx.reply(
        'You already have an active game or analysis in progress.',
        Markup.inlineKeyboard([
          Markup.button.callback('Cancel Game', `cancel_${userId}`)
        ])
      );
      return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    if (!file.file_path.endsWith('.jpg') && !file.file_path.endsWith('.png')) {
      await ctx.reply('Only JPG and PNG images are supported.');
      return;
    }

    const response = await fetch(fileUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const gameId = uuidv4();
    const now = Date.now();
    activeGames[userId] = {
      gameId,
      state: 'analyzing',
      imageBuffer,
      gameStartTime: now,
      lastResponseTime: now
    };

    await ctx.reply('Analyzing image...');

    const result = await analyzeImage(imageBuffer, { debug: false });

    if (!result.json.people || result.json.people.length < 2) {
      delete activeGames[userId];
      await ctx.reply('Error: Image must contain at least 2 people. Please upload a different image.');
      return;
    }

    activeGames[userId].state = 'naming';
    activeGames[userId].result = result;
    activeGames[userId].currentNamingIndex = 0;
    activeGames[userId].assignedNames = [];
    activeGames[userId].lastResponseTime = Date.now();

    await ctx.reply('Image analyzed successfully!');
    
    const firstFace = result.faces[0];
    await ctx.replyWithPhoto(
      { source: firstFace.buffer },
      {
        caption: `Please give a name to Person #${firstFace.index} (Only letters A-Z, a-z allowed):`
      }
    );

  } catch (error) {
    console.error('Error handling photo:', error);
    delete activeGames[userId];
    await ctx.reply('An error occurred while processing the image. Please try again.');
  }
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userGame = activeGames[userId];

  if (!userGame) {
    return;
  }

  if (!isGameValid(userId)) {
    await ctx.reply('Your game has expired. Please start a new game by uploading an image.');
    delete activeGames[userId];
    return;
  }

  try {
    if (userGame.state === 'naming') {
      userGame.lastResponseTime = Date.now();
      const name = ctx.message.text.trim();
      
      if (!/^[a-zA-Z]+$/.test(name)) {
        await ctx.reply('Name must contain only letters (A-Z, a-z). Please try again:');
        return;
      }

      if (userGame.assignedNames.includes(name)) {
        await ctx.reply('This name is already used. Please choose a different name:');
        return;
      }

      userGame.assignedNames.push(name);
      userGame.result.json.people[userGame.currentNamingIndex].name = name;
      userGame.currentNamingIndex++;

      if (userGame.currentNamingIndex < userGame.result.faces.length) {
        const nextFace = userGame.result.faces[userGame.currentNamingIndex];
        await ctx.replyWithPhoto(
          { source: nextFace.buffer },
          {
            caption: `Please give a name to Person #${nextFace.index} (Only letters A-Z, a-z allowed):`
          }
        );
      } else {
        userGame.state = 'playing';
        userGame.gameAnalyze = userGame.result.json;
        userGame.gameState = initializeGuessingGame(userGame.result.json);
        userGame.lastResponseTime = Date.now();

        await ctx.reply('All people named! Starting the guessing game...\n\nThink of one person from the group above...');

        const response = await apiChat(userGame.gameState.messages);
        const aiMessage = response.choices[0].message.content;
        const aiResponse = JSON.parse(aiMessage);

        userGame.gameState.messages.push({
          role: "assistant",
          content: aiMessage
        });

        const questionMsg = await ctx.reply(
          `❓ Question #${aiResponse.questionNumber}:\n${aiResponse.question}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Yes', `Yes_${userId}_${userGame.gameId}`),
              Markup.button.callback('❌ No', `No_${userId}_${userGame.gameId}`),
              Markup.button.callback('🤷‍♂️ Unsure', `Unsure_${userId}_${userGame.gameId}`)
            ]
          ])
        );
        userGame.lastQuestionMessageId = questionMsg.message_id;
        userGame.lastQuestionNumber = aiResponse.questionNumber;
        userGame.lastQuestionText = aiResponse.question;
      }
    }
  } catch (error) {
    console.error('Error handling text:', error);
    await ctx.reply('An error occurred. Please try again or use /cancel to restart.');
  }
});

// Callback Query Handlers
async function handleCancelCallback(ctx, userId, callbackData) {
  const targetUserId = parseInt(callbackData.split('_')[1]);
  if (targetUserId === userId && activeGames[userId]) {
    delete activeGames[userId];
    await ctx.answerCbQuery('Game cancelled');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.reply('Game cancelled. You can start a new game by uploading an image.');
  } else {
    await ctx.answerCbQuery('No active game found');
  }
}

async function sendGuessMessage(ctx, userId, userGame, guessed, person, guessFace, questionNumber, isFinal = false) {
  let caption = isFinal ? `Final Guess!\n\n` : `❓ Question #${questionNumber}: I've got it!\n\n`;
  caption += `I think you're thinking of: ${guessed.personName} (Person #${guessed.personIndex})`;

  const guessMsg = await ctx.replyWithPhoto(
    { source: guessFace.buffer },
    {
      caption: caption,
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback('✅ Correct', `GuessYes_${userId}_${userGame.gameId}`),
            Markup.button.callback('❌ Wrong', `GuessNo_${userId}_${userGame.gameId}`)
          ]
        ]
      }
    }
  );
  userGame.guessMessageId = guessMsg.message_id;
}

async function sendNextQuestion(ctx, userId, userGame, aiResponse) {
  const questionMsg = await ctx.reply(
    `❓ Question #${aiResponse.questionNumber}:\n${aiResponse.question}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes', `Yes_${userId}_${userGame.gameId}`),
        Markup.button.callback('❌ No', `No_${userId}_${userGame.gameId}`),
        Markup.button.callback('🤷‍♂️ Unsure', `Unsure_${userId}_${userGame.gameId}`)
      ]
    ])
  );
  userGame.lastQuestionMessageId = questionMsg.message_id;
  userGame.lastQuestionNumber = aiResponse.questionNumber;
  userGame.lastQuestionText = aiResponse.question;
}

async function handlePlayingState(ctx, userId, userGame, answer) {
  let answerText;
  let answerEmoji;
  if (answer === 'Yes') {
    answerText = 'yes';
    answerEmoji = '✅ Yes';
  } else if (answer === 'No') {
    answerText = 'no';
    answerEmoji = '❌ No';
  } else {
    answerText = 'unsure - I cannot clearly determine this feature or I don\'t know';
    answerEmoji = '🤷‍♂️ Unsure';
  }

  if (userGame.lastQuestionMessageId) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        userGame.lastQuestionMessageId,
        undefined,
        `❓ Question #${userGame.lastQuestionNumber}:\n${userGame.lastQuestionText}\n\nYour answer: ${answerEmoji}`
      );
    } catch (e) {
      console.error('Error editing message:', e);
    }
  }

  userGame.gameState.messages.push({
    role: "user",
    content: answerText
  });

  const response = await apiChat(userGame.gameState.messages);
  const aiMessage = response.choices[0].message.content;
  const aiResponse = JSON.parse(aiMessage);

  userGame.gameState.messages.push({
    role: "assistant",
    content: aiMessage
  });

  if (aiResponse.isGuessed) {
    userGame.state = 'guessVerify';
    userGame.lastResponseTime = Date.now();
    const guessed = aiResponse.guessed;
    const person = userGame.gameAnalyze.people.find(p => p.personIndex === guessed.personIndex);
    const guessFace = userGame.result.faces.find(f => f.index === guessed.personIndex);

    userGame.currentGuess = { guessed, person, aiResponse };
    await sendGuessMessage(ctx, userId, userGame, guessed, person, guessFace, aiResponse.questionNumber);
  } else {
    if (aiResponse.questionNumber >= userGame.gameState.maxQuestions) {
      await handleMaxQuestionsReached(ctx, userId, userGame);
    } else {
      await sendNextQuestion(ctx, userId, userGame, aiResponse);
    }
  }
}

async function handleMaxQuestionsReached(ctx, userId, userGame) {
  userGame.gameState.messages.push({
    role: "user",
    content: `You have reached the maximum number of questions (${userGame.gameState.maxQuestions}). You MUST make your final guess now based on all the information you have gathered.`
  });

  const finalResponse = await apiChat(userGame.gameState.messages);
  const finalAiMessage = finalResponse.choices[0].message.content;
  const finalAiResponse = JSON.parse(finalAiMessage);

  userGame.gameState.messages.push({
    role: "assistant",
    content: finalAiMessage
  });

  if (finalAiResponse.isGuessed) {
    userGame.state = 'guessVerify';
    userGame.lastResponseTime = Date.now();
    const guessed = finalAiResponse.guessed;
    const person = userGame.gameAnalyze.people.find(p => p.personIndex === guessed.personIndex);
    const guessFace = userGame.result.faces.find(f => f.index === guessed.personIndex);

    userGame.currentGuess = { guessed, person, aiResponse: finalAiResponse };
    await sendGuessMessage(ctx, userId, userGame, guessed, person, guessFace, null, true);
  }
}

async function handleCorrectGuess(ctx, userId, userGame) {
  let summaryText = '🎉 Yay! I guessed correctly! Thanks for playing!\n\n' + formatAnalysisSummary(userGame.currentGuess.person);
  
  if (userGame.currentGuess.guessed.extraNote) {
    summaryText += '\n\n💡 Note: ' + userGame.currentGuess.guessed.extraNote;
  }
  
  if (userGame.guessMessageId) {
    await ctx.reply(summaryText, { reply_to_message_id: userGame.guessMessageId });
  } else {
    await ctx.reply(summaryText);
  }
  
  if (sendAnnotated && userGame.result.annotated) {
    await ctx.replyWithPhoto(
      { source: userGame.result.annotated },
      { caption: 'Annotated Image' }
    );
  }
  
  delete activeGames[userId];
}

async function handleWrongGuess(ctx, userId, userGame) {
  const remainingQuestions = userGame.gameState.maxQuestions - userGame.currentGuess.aiResponse.questionNumber;
  
  if (remainingQuestions > 0) {
    await ctx.reply(`😞 Oops! Let me try again. I have ${remainingQuestions} questions left.`);
    
    userGame.state = 'playing';
    userGame.lastResponseTime = Date.now();
    userGame.gameState.messages.push({
      role: "user",
      content: `no, that was wrong. I was not thinking of ${userGame.currentGuess.guessed.personName}. You have ${remainingQuestions} questions remaining. Re-think your approach, verify previous answers if needed, and continue asking questions.`
    });

    const response = await apiChat(userGame.gameState.messages);
    const aiMessage = response.choices[0].message.content;
    const aiResponse = JSON.parse(aiMessage);

    userGame.gameState.messages.push({
      role: "assistant",
      content: aiMessage
    });

    await sendNextQuestion(ctx, userId, userGame, aiResponse);
  } else {
    await ctx.reply('😞 Oops! I was wrong and I have no questions left. You win!');
    
    if (sendAnnotated && userGame.result.annotatedBuffer) {
      await ctx.replyWithPhoto(
        { source: userGame.result.annotatedBuffer },
        { caption: 'Annotated Image' }
      );
    }
    
    delete activeGames[userId];
  }
}

async function handleGuessVerifyState(ctx, userId, userGame, answer) {
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

  if (answer === 'GuessYes') {
    await handleCorrectGuess(ctx, userId, userGame);
  } else if (answer === 'GuessNo') {
    await handleWrongGuess(ctx, userId, userGame);
  }
}

bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  try {
    if (!callbackData.startsWith('cancel_') && activeGames[userId]) {
      if (!isGameValid(userId)) {
        await ctx.answerCbQuery('Game expired');
        await ctx.reply('Your game has expired due to inactivity. Please start a new game by uploading an image.');
        delete activeGames[userId];
        return;
      }
      activeGames[userId].lastResponseTime = Date.now();
    }

    if (callbackData.startsWith('cancel_')) {
      await handleCancelCallback(ctx, userId, callbackData);
      return;
    }

    const [answer, targetUserId, gameId] = callbackData.split('_');
    const userGame = activeGames[userId];

    if (!userGame || userGame.gameId !== gameId) {
      await ctx.answerCbQuery('Game not found or expired');
      return;
    }

    if (parseInt(targetUserId) !== userId) {
      await ctx.answerCbQuery('This is not your game');
      return;
    }

    await ctx.answerCbQuery();

    if (userGame.state === 'playing') {
      await handlePlayingState(ctx, userId, userGame, answer);
    } else if (userGame.state === 'guessVerify') {
      await handleGuessVerifyState(ctx, userId, userGame, answer);
    }
  } catch (error) {
    console.error('Error handling callback:', error);
    await ctx.answerCbQuery('An error occurred');
    await ctx.reply('An error occurred. Please use /cancel to restart.');
  }
});

console.log('Bot is starting...');
bot.launch();
console.log('Bot started successfully.');


process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
