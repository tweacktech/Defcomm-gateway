import os
import tempfile
from typing import Optional
from deep_translator import GoogleTranslator


#  This function translates text between languages using Google Translator
def translate_text(source_lang=None, target_lang=None, text_to_translate=None,speech=True):
    """
    Translate text between languages using Google Translator

    Args:
        source_lang (str): Source language
        target_lang (str): Target language
        text_to_translate (str): Text to translate

    Returns:
        str: Translated text or error message
    """
    # Create an instance to get supported languages
    translator = GoogleTranslator(source='en', target='es')
    list_of_sources = translator.get_supported_languages(as_dict=True)

    # Get input if not provided
    if source_lang is None:
        source_lang = input("Enter the source language: ")
    if target_lang is None:
        target_lang = input("Enter the target language: ")
    if text_to_translate is None:
        text_to_translate = input("Enter the text to be translated: ")

    # Check if both languages are supported
    if (source_lang in list_of_sources or source_lang in list_of_sources.values()) and \
       (target_lang in list_of_sources or target_lang in list_of_sources.values()):

        translated = GoogleTranslator(
            source=source_lang,
            target=target_lang
        ).translate(text_to_translate)

        result = f"Translated text: {translated}"
        print(result)
        if speech:
            text_to_speech_advanced(translated, language=target_lang)
        return translated
    else:
        error_msg = f"Either '{source_lang}' or '{target_lang}' is not supported"
        print(error_msg)
        return error_msg


# this function
def text_to_speech_advanced(
    text: str,
    language: str = 'en',
    engine: str = 'gtts',
    voice: str = 'female',
    speed: float = 1.0,
    save_path: Optional[str] = None,
    play: bool = True
) -> Optional[str]:
    """
    Advanced text-to-speech function supporting multiple engines

    Args:
        text: Text to convert to speech
        language: Language code (en, es, fr, de, etc.)
        engine: 'gtts' (online) or 'pyttsx3' (offline)
        voice: 'male' or 'female' (for pyttsx3)
        speed: Speaking speed (0.5 to 2.0)
        save_path: Path to save audio file
        play: Whether to play audio immediately

    Returns:
        Path to audio file if saved, None otherwise
    """

    if engine.lower() == 'gtts':
        # Online engine (gTTS)
        try:
            from gtts import gTTS

            # Adjust speed (gTTS only supports slow=True/False)
            slow = speed < 1.0 and speed >= 0.5

            tts = gTTS(text=text, lang=language, slow=slow)

            if save_path:
                tts.save(save_path)
                audio_file = save_path
            else:
                temp_dir = tempfile.gettempdir()
                audio_file = os.path.join(temp_dir, f"tts_{hash(text)}.mp3")
                tts.save(audio_file)

            if play:
                if os.name == 'nt':
                    os.system(f"start {audio_file}")
                elif os.name == 'posix':
                    if 'darwin' in os.uname().sysname.lower():
                        os.system(f"afplay {audio_file}")
                    else:
                        os.system(f"mpg123 {audio_file} || play {audio_file}")

            return audio_file

        except ImportError:
            print("gTTS not installed. Install with: pip install gtts")
            return None

    elif engine.lower() == 'pyttsx3':
        # Offline engine
        try:
            import pyttsx3

            engine = pyttsx3.init()

            # Set voice
            voices = engine.getProperty('voices')
            if voice.lower() == 'female' and len(voices) > 1:
                engine.setProperty('voice', voices[1].id)
            else:
                engine.setProperty('voice', voices[0].id)

            # Set rate and volume
            current_rate = engine.getProperty('rate')
            engine.setProperty('rate', int(current_rate * speed))
            engine.setProperty('volume', 1.0)

            # Speak
            engine.say(text)
            engine.runAndWait()

            return None

        except ImportError:
            print("pyttsx3 not installed. Install with: pip install pyttsx3")
            return None

    else:
        print(f"Engine '{engine}' not supported. Use 'gtts' or 'pyttsx3'")
        return None


# this function converts speech to text using Google Speech Recognition API. It supports both microphone input and audio file input, with configurable language, timeout, and phrase time limit. It handles various exceptions and provides feedback to the user.
def speech_to_text(
    language: str = "en-US",
    source: str = "mic",
    audio_file: Optional[str] = None,
    timeout: int = 5,
    phrase_time_limit: int = 10
) -> Optional[str]:
    """
    Convert speech to text using Google Speech Recognition

    Args:
        language: Language code (en-US, es-ES, fr-FR, etc.)
        source: 'mic' for microphone or 'file' for audio file
        audio_file: path to audio file if source='file'
        timeout: seconds to wait before listening
        phrase_time_limit: max seconds for recording

    Returns:
        Recognized text or None
    """

    try:
        import speech_recognition as sr
    except ImportError:
        print("Install SpeechRecognition: pip install SpeechRecognition")
        return None

    recognizer = sr.Recognizer()

    try:
        # -------- MICROPHONE INPUT --------
        if source == "mic":
            with sr.Microphone() as mic:
                print("🎤 Adjusting for noise...")
                recognizer.adjust_for_ambient_noise(mic, duration=1)

                print("🎤 Speak now...")
                audio = recognizer.listen(
                    mic,
                    timeout=timeout,
                    phrase_time_limit=phrase_time_limit
                )

        # -------- AUDIO FILE INPUT --------
        elif source == "file" and audio_file:
            with sr.AudioFile(audio_file) as src:
                audio = recognizer.record(src)

        else:
            print("Invalid source. Use 'mic' or provide audio file.")
            return None

        # -------- TRANSCRIPTION --------
        text = recognizer.recognize_google(audio, language=language)

        print(f"Recognized Text: {text}")
        return text

    except sr.WaitTimeoutError:
        print("Listening timed out.")
    except sr.UnknownValueError:
        print("Could not understand audio.")
    except sr.RequestError as e:
        print(f"API error: {e}")

    return None


# Call the function in different ways:
if __name__ == "__main__":
    # Way 1: Interactive mode (with prompts)
    # translate_text()

    # Way 2: Direct mode (with parameters)
    # translate_text("english", "spanish", "Hello, how are you?")

      # Online version
    # text_to_speech_advanced(
    #     "Hello, this is a test of the text to speech system.",
    #     language='en',
    #     engine='gtts',
    #     play=True
    # )

    # Offline version (if pyttsx3 installed)
    # text_to_speech_advanced("Hello world", engine='pyttsx3', voice='male')


    speech_to_text(
    source="mic", #// mic or file
    audio_file="voice.wav",
    language="ng-NG", # fr-FR, en-US, es-ES, ng etc.
)
# // For microphone input
# speech_to_text(source="mic", language="en-US")
