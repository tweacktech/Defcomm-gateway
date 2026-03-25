import os
import sys
import tempfile
from typing import Optional
from deep_translator import GoogleTranslator
import argparse


# ─────────────────────────────────────────────────────────────────────────────
# LANGUAGE MAPS
# ─────────────────────────────────────────────────────────────────────────────

# gTTS only supports a subset of languages.
# Yoruba (yo) and Igbo (ig) are NOT supported — we fall back to English TTS
# while still translating the text correctly.
GTTS_SUPPORTED = {
    "en", "ha",                    # English, Hausa (supported)
    "fr", "es", "de", "pt", "ar",  # other common languages
    "sw", "zu", "af",              # some African languages gTTS supports
}

NIGERIAN_LANGUAGE_MAP = {
    # STT codes (Google Speech Recognition)
    "stt": {
        "english":  "en-NG",
        "hausa":    "ha-NG",
        "yoruba":   "yo-NG",
        "igbo":     "ig-NG",
        "pidgin":   "en-NG",   # No native pidgin STT — falls back to English (NG)
    },
    # Preferred TTS codes — checked against GTTS_SUPPORTED at runtime
    "tts": {
        "english":  "en",
        "hausa":    "ha",
        "yoruba":   "yo",   # ⚠️ not supported by gTTS — will fallback to "en"
        "igbo":     "ig",   # ⚠️ not supported by gTTS — will fallback to "en"
        "pidgin":   "en",
    },
    # Translation codes (deep_translator / GoogleTranslator)
    "translate": {
        "english":  "english",
        "hausa":    "hausa",
        "yoruba":   "yoruba",
        "igbo":     "igbo",
        "pidgin":   "english",
    }
}


def resolve_tts_language(lang_code: str, engine: str = "gtts") -> str:
    """
    Return a TTS-safe language code.
    If the preferred code isn't supported by the engine, fall back to 'en'
    and warn the user.
    """
    if engine.lower() == "gtts" and lang_code not in GTTS_SUPPORTED:
        print(
            f"gTTS does not support '{lang_code}' — speaking in English instead.",
            file=sys.stderr,
        )
        return "en"
    return lang_code


# ─────────────────────────────────────────────────────────────────────────────
# 1. TEXT-TO-SPEECH
# ─────────────────────────────────────────────────────────────────────────────

def text_to_speech_advanced(
    text: str,
    language: str = "en",
    engine: str = "gtts",
    voice: str = "female",
    speed: float = 1.0,
    save_path: Optional[str] = None,
    play: bool = True
) -> Optional[str]:
    """
    Convert text to speech using gTTS (online) or pyttsx3 (offline).

    Args:
        text:       Text to convert to speech.
        language:   Language code (en, yo, ha, ig, fr, es …).
        engine:     'gtts' for online or 'pyttsx3' for offline.
        voice:      'male' or 'female' (pyttsx3 only).
        speed:      Speaking speed 0.5–2.0 (gTTS only supports slow mode < 1.0).
        save_path:  Optional file path to save the audio.
        play:       Whether to play audio immediately.

    Returns:
        Path to the saved audio file, or None.
    """

    if engine.lower() == "gtts":
        try:
            from gtts import gTTS

            slow = 0.5 <= speed < 1.0
            tts = gTTS(text=text, lang=language, slow=slow)

            if save_path:
                tts.save(save_path)
                audio_file = save_path
            else:
                temp_dir = tempfile.gettempdir()
                audio_file = os.path.join(temp_dir, f"tts_{abs(hash(text))}.mp3")
                tts.save(audio_file)

            if play:
                if os.name == "nt":                              # Windows
                    os.system(f'start "" "{audio_file}"')
                elif os.name == "posix":
                    sysname = os.uname().sysname.lower()
                    if "darwin" in sysname:                      # macOS
                        os.system(f'afplay "{audio_file}"')
                    else:                                        # Linux
                        os.system(f'mpg123 "{audio_file}" 2>/dev/null || play "{audio_file}"')

            return audio_file

        except ImportError:
            print("gTTS not installed. Run: pip install gtts", file=sys.stderr)
            return None
        except Exception as e:
            print(f"gTTS error: {e}", file=sys.stderr)
            return None

    elif engine.lower() == "pyttsx3":
        try:
            import pyttsx3

            _engine = pyttsx3.init()

            voices = _engine.getProperty("voices")
            if voice.lower() == "female" and len(voices) > 1:
                _engine.setProperty("voice", voices[1].id)
            else:
                _engine.setProperty("voice", voices[0].id)

            current_rate = _engine.getProperty("rate")
            _engine.setProperty("rate", int(current_rate * speed))
            _engine.setProperty("volume", 1.0)

            if save_path:
                _engine.save_to_file(text, save_path)
                _engine.runAndWait()
                return save_path

            _engine.say(text)
            _engine.runAndWait()
            return None

        except ImportError:
            print("pyttsx3 not installed. Run: pip install pyttsx3", file=sys.stderr)
            return None
        except Exception as e:
            print(f"pyttsx3 error: {e}", file=sys.stderr)
            return None

    else:
        print(f"Engine '{engine}' not supported. Use 'gtts' or 'pyttsx3'.", file=sys.stderr)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 2. SPEECH-TO-TEXT
# ─────────────────────────────────────────────────────────────────────────────

def speech_to_text(
    language: str = "en-US",
    source: str = "mic",
    audio_file: Optional[str] = None,
    timeout: int = 5,
    phrase_time_limit: int = 10
) -> Optional[str]:
    """
    Convert speech to text using Google Speech Recognition.

    Args:
        language:         BCP-47 language code (en-US, en-NG, yo-NG, ha-NG, ig-NG …).
        source:           'mic' for microphone or 'file' for audio file.
        audio_file:       Path to audio file when source='file'.
        timeout:          Seconds to wait before giving up listening.
        phrase_time_limit: Max recording duration in seconds.

    Returns:
        Recognised text string, or None on failure.
    """

    try:
        import speech_recognition as sr
    except ImportError:
        print("SpeechRecognition not installed. Run: pip install SpeechRecognition", file=sys.stderr)
        return None

    recognizer = sr.Recognizer()

    try:
        if source == "mic":
            try:
                mic = sr.Microphone()
            except OSError:
                print("No microphone found. Check your audio device.", file=sys.stderr)
                return None

            with mic:
                print("Adjusting for ambient noise…", file=sys.stderr)
                recognizer.adjust_for_ambient_noise(mic, duration=1)
                print("Speak now…", file=sys.stderr)
                audio = recognizer.listen(
                    mic,
                    timeout=timeout,
                    phrase_time_limit=phrase_time_limit
                )

        elif source == "file":
            if not audio_file:
                print("Please provide an audio_file path when source='file'.", file=sys.stderr)
                return None
            if not os.path.exists(audio_file):
                print(f"Audio file not found: {audio_file}", file=sys.stderr)
                return None
            with sr.AudioFile(audio_file) as src:
                audio = recognizer.record(src)

        else:
            print("Invalid source. Use 'mic' or 'file'.", file=sys.stderr)
            return None

        text = recognizer.recognize_google(audio, language=language)
        print(f"Recognised: \"{text}\"", file=sys.stderr)
        return text

    except sr.WaitTimeoutError:
        print("Listening timed out — no speech detected.", file=sys.stderr)
    except sr.UnknownValueError:
        print("Could not understand audio.", file=sys.stderr)
    except sr.RequestError as e:
        print(f"Google API error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected STT error: {e}", file=sys.stderr)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. TEXT TRANSLATION  (standalone utility, also used internally)
# ─────────────────────────────────────────────────────────────────────────────

def translate_text(
    source_lang: Optional[str] = None,
    target_lang: Optional[str] = None,
    text_to_translate: Optional[str] = None,
    speech: bool = True
) -> Optional[str]:
    """
    Translate text between any two languages supported by Google Translate.

    Args:
        source_lang:       Source language name or code.
        target_lang:       Target language name or code.
        text_to_translate: Text to translate.
        speech:            If True, speak the translated result via gTTS.

    Returns:
        Translated text string, or an error message.
    """

    translator = GoogleTranslator(source="en", target="es")
    list_of_sources = translator.get_supported_languages(as_dict=True)

    if source_lang is None:
        source_lang = input("Enter the source language: ").strip()
    if target_lang is None:
        target_lang = input("Enter the target language: ").strip()
    if text_to_translate is None:
        text_to_translate = input("Enter the text to be translated: ").strip()

    source_lang = source_lang.lower()
    target_lang = target_lang.lower()

    source_ok = source_lang in list_of_sources or source_lang in list_of_sources.values()
    target_ok = target_lang in list_of_sources or target_lang in list_of_sources.values()

    if source_ok and target_ok:
        try:
            translated = GoogleTranslator(
                source=source_lang,
                target=target_lang
            ).translate(text_to_translate)

            print(f"Translated text: {translated}", file=sys.stderr)

            if speech:
                tts_lang = target_lang[:2]   # 'yoruba' → 'yo', 'english' → 'en'
                text_to_speech_advanced(translated, language=tts_lang)

            return translated

        except Exception as e:
            error_msg = f"Translation error: {e}"
            print(error_msg, file=sys.stderr)
            return error_msg
    else:
        error_msg = f"'{source_lang}' or '{target_lang}' is not supported."
        print(error_msg, file=sys.stderr)
        return error_msg


# ─────────────────────────────────────────────────────────────────────────────
# 4. SPEECH-TO-SPEECH  (full pipeline)
# ─────────────────────────────────────────────────────────────────────────────

def speech_to_speech(
    source_lang: str = "english",
    target_lang: str = "yoruba",
    source: str = "mic",
    audio_file: Optional[str] = None,
    engine: str = "gtts",
    timeout: int = 5,
    phrase_time_limit: int = 10,
    save_output: Optional[str] = None,
    play: bool = True,
    do_tts: bool = True,
) -> Optional[str]:
    """
    Full speech-to-speech translation pipeline.

    Flow:  Microphone/File → STT → Translate → TTS → Speaker/File

    Supported Nigerian languages: english, hausa, yoruba, igbo, pidgin
    (pidgin falls back to English STT/TTS — no native model exists yet)

    Args:
        source_lang:       Input language name  (e.g. 'english', 'yoruba').
        target_lang:       Output language name (e.g. 'hausa', 'igbo').
        source:            'mic' or 'file'.
        audio_file:        Path to audio file when source='file'.
        engine:            TTS engine — 'gtts' (online) or 'pyttsx3' (offline).
        timeout:           Mic listen timeout in seconds.
        phrase_time_limit: Max mic recording duration in seconds.
        save_output:       Optional path to save the output audio file.

    Returns:
        Translated text string, or None on failure.
    """

    source_lang = source_lang.lower().strip()
    target_lang = target_lang.lower().strip()

    supported = list(NIGERIAN_LANGUAGE_MAP["stt"].keys())

    # ── Validate ────────────────────────────────────────────────────────────
    if source_lang not in supported:
        print(f"Source language '{source_lang}' not supported.", file=sys.stderr)
        print(f"Choose from: {supported}", file=sys.stderr)
        return None

    if target_lang not in supported:
        print(f"Target language '{target_lang}' not supported.", file=sys.stderr)
        print(f"Choose from: {supported}", file=sys.stderr)
        return None

    # ── Step 1 : Speech → Text ───────────────────────────────────────────────
    recognized_text = speech_to_text(
        language=NIGERIAN_LANGUAGE_MAP["stt"][source_lang],
        source=source,
        audio_file=audio_file,
        timeout=timeout,
        phrase_time_limit=phrase_time_limit
    )

    if not recognized_text:
        print("Speech recognition failed. Aborting.", file=sys.stderr)
        return None

    # ── Step 2 : Text → Translated Text ─────────────────────────────────────
    if source_lang == target_lang:
        translated_text = recognized_text
    else:
        try:
            translated_text = GoogleTranslator(
                source=NIGERIAN_LANGUAGE_MAP["translate"][source_lang],
                target=NIGERIAN_LANGUAGE_MAP["translate"][target_lang]
            ).translate(recognized_text)

            if not translated_text:
                print("Translation returned empty result.", file=sys.stderr)
                return None

        except Exception as e:
            print(f"Translation error: {e}", file=sys.stderr)
            return None

    if do_tts:
        # ── Step 3 : Translated Text → Speech ───────────────────────────────
        tts_lang = resolve_tts_language(
            NIGERIAN_LANGUAGE_MAP["tts"][target_lang],
            engine=engine
        )

        text_to_speech_advanced(
            text=translated_text,
            language=tts_lang,
            engine=engine,
            play=play,
            save_path=save_output
        )

        if save_output:
            print(f"Output saved to: {save_output}", file=sys.stderr)
    return translated_text


# ─────────────────────────────────────────────────────────────────────────────
# 5. INTERACTIVE CLI WRAPPER
# ─────────────────────────────────────────────────────────────────────────────

def speech_to_speech_interactive():
    """Prompt-driven CLI mode — useful for quick manual testing."""

    supported = list(NIGERIAN_LANGUAGE_MAP["stt"].keys())
    print("\n🌍  Nigerian Speech-to-Speech Translator")
    print(f"   Supported languages: {', '.join(supported)}\n")

    source_lang  = input("Source language [english]: ").strip().lower() or "english"
    target_lang  = input("Target language [yoruba]:  ").strip().lower() or "yoruba"
    source       = input("Input source (mic/file) [mic]: ").strip().lower() or "mic"
    audio_file   = None

    if source == "file":
        audio_file = input("Audio file path: ").strip()

    save_output  = input("Save output audio? Enter path or leave blank: ").strip() or None

    speech_to_speech(
        source_lang=source_lang,
        target_lang=target_lang,
        source=source,
        audio_file=audio_file,
        save_output=save_output,
        play=True,
        do_tts=True,
    )


def _translate_nigerian_text(source_lang: str, target_lang: str, text: str) -> str:
    source_lang = source_lang.lower().strip()
    target_lang = target_lang.lower().strip()

    supported = list(NIGERIAN_LANGUAGE_MAP["translate"].keys())
    if source_lang not in supported:
        raise ValueError(f"Unsupported source_lang '{source_lang}'. Choose from: {supported}")
    if target_lang not in supported:
        raise ValueError(f"Unsupported target_lang '{target_lang}'. Choose from: {supported}")

    translated = GoogleTranslator(
        source=NIGERIAN_LANGUAGE_MAP["translate"][source_lang],
        target=NIGERIAN_LANGUAGE_MAP["translate"][target_lang],
    ).translate(text)
    if not translated:
        raise RuntimeError("Translation returned empty result.")
    return translated


# def main(argv) -> int:
#     parser = argparse.ArgumentParser(description="Speech/text translation utility")
#     parser.add_argument("--source", required=True, help="Source language (english|hausa|yoruba|igbo|pidgin)")
#     parser.add_argument("--target", required=True, help="Target language (english|hausa|yoruba|igbo|pidgin)")
#     parser.add_argument("--text", help="Text to translate (text-to-text)")
#     parser.add_argument("--file", dest="audio_file", help="Audio file path (speech-to-speech via file)")
#     parser.add_argument("--engine", default="gtts", choices=["gtts", "pyttsx3"], help="TTS engine")
#     parser.add_argument("--save-output", dest="save_output", help="Optional output audio path")
#     parser.add_argument("--play", action="store_true", help="Play generated audio (default: false)")
#     parser.add_argument("--tts", action="store_true", help="Enable text-to-speech output (default: false)")

#     args = parser.parse_args(argv)

#     try:
#         if bool(args.text) == bool(args.audio_file):
#             raise ValueError("Provide exactly one of --text or --file.")

#         if args.text is not None:
#             out = _translate_nigerian_text(args.source, args.target, args.text)
#             print(out)
#             return 0

#         out = speech_to_speech(
#             source_lang=args.source,
#             target_lang=args.target,
#             source="file",
#             audio_file=args.audio_file,
#             engine=args.engine,
#             save_output=args.save_output,
#             play=args.play,
#             do_tts=args.tts,
#         )
#         if not out:
#             raise RuntimeError("Speech pipeline failed.")
#         print(out)
#         return 0

#     except Exception as e:
#         print(str(e), file=sys.stderr)
#         return 2


# # ─────────────────────────────────────────────────────────────────────────────
# # ENTRY POINT
# # ─────────────────────────────────────────────────────────────────────────────

# if __name__ == "__main__":
#     raise SystemExit(main(sys.argv[1:]))


def main(argv) -> int:
    parser = argparse.ArgumentParser(description="Speech/text translation utility")
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--text", help="Text to translate")
    parser.add_argument("--file", dest="audio_file", help="Audio file path")
    parser.add_argument("--engine", default="gtts", choices=["gtts", "pyttsx3"])
    parser.add_argument("--save-output", dest="save_output", help="Output audio path")
    parser.add_argument("--play", action="store_true")
    parser.add_argument("--tts", action="store_true")

    args = parser.parse_args(argv)

    try:
        if bool(args.text) == bool(args.audio_file):
            raise ValueError("Provide exactly one of --text or --file.")

        if args.text is not None:
            # Step 1: translate
            translated = _translate_nigerian_text(args.source, args.target, args.text)

            # Step 2: TTS — THIS was the missing piece, save_output was never passed
            if args.tts:
                tts_lang = resolve_tts_language(
                    NIGERIAN_LANGUAGE_MAP["tts"].get(args.target.lower().strip(), "en"),
                    engine=args.engine
                )

                # Ensure the output directory exists
                if args.save_output:
                    os.makedirs(os.path.dirname(args.save_output), exist_ok=True)

                audio_path = text_to_speech_advanced(
                    text=translated,
                    language=tts_lang,
                    engine=args.engine,
                    play=args.play,
                    save_path=args.save_output,  # ✅ now actually passed
                )

                print(f"AUDIO:{audio_path}", file=sys.stderr)  # visible in Laravel logs

            # stdout goes back to Laravel as $result->output()
            print(translated)
            return 0

        # --file branch (speech-to-speech)
        out = speech_to_speech(
            source_lang=args.source,
            target_lang=args.target,
            source="file",
            audio_file=args.audio_file,
            engine=args.engine,
            save_output=args.save_output,
            play=args.play,
            do_tts=args.tts,
        )
        if not out:
            raise RuntimeError("Speech pipeline failed.")
        print(out)
        return 0

    except Exception as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))


# **Root cause summary:**
# ```
# Before fix:
# --text branch → _translate_nigerian_text() → print(translated) → exits
#                 ↑ TTS never called, save_output never used

# After fix:
# --text branch → _translate_nigerian_text()
#               → text_to_speech_advanced(save_path=args.save_output)  ✅
#               → print(translated)
