import os
import sys
import tempfile
import subprocess
from typing import Optional
import argparse

# ─────────────────────────────────────────────────────────────────────────────
# LANGUAGE MAPS
# ─────────────────────────────────────────────────────────────────────────────

GTTS_SUPPORTED = {
    "en", "ha", "fr", "es", "de", "pt", "ar", "sw", "zu", "af"
}

NIGERIAN_LANGUAGE_MAP = {
    "stt": {
        "english": "en-NG",
        "hausa": "ha-NG",
        "yoruba": "yo-NG",
        "igbo": "ig-NG",
        "pidgin": "en-NG",
    },
    "tts": {
        "english": "en",
        "hausa": "ha",
        "yoruba": "yo",  # ⚠ fallback to en
        "igbo": "ig",    # ⚠ fallback to en
        "pidgin": "en",
    },
    "translate": {
        "english": "english",
        "hausa": "hausa",
        "yoruba": "yoruba",
        "igbo": "igbo",
        "pidgin": "english",
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER: TTS language resolution
# ─────────────────────────────────────────────────────────────────────────────

def resolve_tts_language(lang_code: str, engine: str = "gtts") -> str:
    if engine.lower() == "gtts" and lang_code not in GTTS_SUPPORTED:
        print(f"gTTS does not support '{lang_code}', using English instead.", file=sys.stderr)
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
    try:
        if engine.lower() == "gtts":
            from gtts import gTTS

            slow = 0.5 <= speed < 1.0
            tts = gTTS(text=text, lang=language, slow=slow)

            if save_path:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                tts.save(save_path)
                audio_file = save_path
            else:
                temp_dir = tempfile.gettempdir()
                audio_file = os.path.join(temp_dir, f"tts_{abs(hash(text))}.mp3")
                tts.save(audio_file)

            if play:
                if os.name == "nt":
                    os.system(f'start "" "{audio_file}"')
                elif os.name == "posix":
                    sysname = os.uname().sysname.lower()
                    if "darwin" in sysname:
                        os.system(f'afplay "{audio_file}"')
                    else:
                        os.system(f'mpg123 "{audio_file}" 2>/dev/null || play "{audio_file}"')

            return audio_file

        elif engine.lower() == "pyttsx3":
            import pyttsx3

            _engine = pyttsx3.init()
            voices = _engine.getProperty("voices")
            if voice.lower() == "female" and len(voices) > 1:
                _engine.setProperty("voice", voices[1].id)
            else:
                _engine.setProperty("voice", voices[0].id)

            _engine.setProperty("rate", int(_engine.getProperty("rate") * speed))
            _engine.setProperty("volume", 1.0)

            if save_path:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                _engine.save_to_file(text, save_path)
                _engine.runAndWait()
                return save_path

            _engine.say(text)
            _engine.runAndWait()
            return None

        else:
            print(f"Engine '{engine}' not supported. Use 'gtts' or 'pyttsx3'.", file=sys.stderr)
            return None

    except ImportError as e:
        print(f"Missing package: {e}. Install required packages.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"TTS error: {e}", file=sys.stderr)
        return None

# ─────────────────────────────────────────────────────────────────────────────
# 2. AUDIO CONVERSION: any → WAV 16kHz mono
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_wav(input_path: str) -> Optional[str]:
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}", file=sys.stderr)
        return None

    if input_path.lower().endswith(".wav"):
        return input_path

    wav_path = os.path.join(tempfile.gettempdir(), f"stt_converted_{abs(hash(input_path))}.wav")
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", input_path,
                "-ar", "16000", "-ac", "1", "-f", "wav", wav_path
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )

        if result.returncode != 0:
            print(f"ffmpeg error: {result.stderr.decode().strip()}", file=sys.stderr)
            return None

        print(f"Converted to wav: {wav_path}", file=sys.stderr)
        return wav_path
    except FileNotFoundError:
        print("ffmpeg not found. Install ffmpeg to convert audio.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Unexpected conversion error: {e}", file=sys.stderr)
        return None

# ─────────────────────────────────────────────────────────────────────────────
# 3. SPEECH-TO-TEXT
# ─────────────────────────────────────────────────────────────────────────────

def speech_to_text(
    language: str = "en-US",
    source: str = "mic",
    audio_file: Optional[str] = None,
    timeout: int = 5,
    phrase_time_limit: int = 10
) -> Optional[str]:
    try:
        import speech_recognition as sr
    except ImportError:
        print("SpeechRecognition package missing. Run: pip install SpeechRecognition", file=sys.stderr)
        return None

    recognizer = sr.Recognizer()
    _temp_wav = None

    try:
        if source == "mic":
            try:
                mic = sr.Microphone()
            except OSError:
                print("No microphone found.", file=sys.stderr)
                return None

            with mic:
                recognizer.adjust_for_ambient_noise(mic, duration=1)
                print("Speak now...", file=sys.stderr)
                audio = recognizer.listen(mic, timeout=timeout, phrase_time_limit=phrase_time_limit)

        elif source == "file":
            if not audio_file or not os.path.exists(audio_file):
                print(f"Audio file not found: {audio_file}", file=sys.stderr)
                return None

            wav_file = convert_to_wav(audio_file)
            if not wav_file:
                print("Audio conversion failed.", file=sys.stderr)
                return None
            if wav_file != audio_file:
                _temp_wav = wav_file

            with sr.AudioFile(wav_file) as src:
                audio = recognizer.record(src)

        else:
            print("Invalid source. Use 'mic' or 'file'.", file=sys.stderr)
            return None

        text = recognizer.recognize_google(audio, language=language)
        print(f"Recognized: \"{text}\"", file=sys.stderr)
        return text

    except sr.WaitTimeoutError:
        print("Listening timed out.", file=sys.stderr)
    except sr.UnknownValueError:
        print("Could not understand audio.", file=sys.stderr)
    except sr.RequestError as e:
        print(f"Google API error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected STT error: {e}", file=sys.stderr)
    finally:
        if _temp_wav and os.path.exists(_temp_wav):
            try:
                os.unlink(_temp_wav)
                print(f"Cleaned up temp wav: {_temp_wav}", file=sys.stderr)
            except Exception:
                pass

    return None

# ─────────────────────────────────────────────────────────────────────────────
# 4. TEXT TRANSLATION
# ─────────────────────────────────────────────────────────────────────────────

def _translate_nigerian_text(source_lang: str, target_lang: str, text: str) -> str:
    from deep_translator import GoogleTranslator
    source_lang = source_lang.lower().strip()
    target_lang = target_lang.lower().strip()
    supported = NIGERIAN_LANGUAGE_MAP["translate"].keys()

    if source_lang not in supported or target_lang not in supported:
        raise ValueError(f"Unsupported translation: {source_lang} → {target_lang}")

    translated = GoogleTranslator(
        source=NIGERIAN_LANGUAGE_MAP["translate"][source_lang],
        target=NIGERIAN_LANGUAGE_MAP["translate"][target_lang]
    ).translate(text)

    if not translated:
        raise RuntimeError("Translation returned empty result.")

    return translated

# ─────────────────────────────────────────────────────────────────────────────
# 5. FULL SPEECH-TO-SPEECH PIPELINE
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
    source_lang = source_lang.lower().strip()
    target_lang = target_lang.lower().strip()
    supported = NIGERIAN_LANGUAGE_MAP["stt"].keys()

    if source_lang not in supported or target_lang not in supported:
        print(f"Unsupported language: {source_lang} → {target_lang}", file=sys.stderr)
        return None

    recognized_text = speech_to_text(
        language=NIGERIAN_LANGUAGE_MAP["stt"][source_lang],
        source=source,
        audio_file=audio_file,
        timeout=timeout,
        phrase_time_limit=phrase_time_limit
    )

    if not recognized_text:
        print("Speech recognition failed.", file=sys.stderr)
        return None

    if source_lang == target_lang:
        translated_text = recognized_text
    else:
        try:
            translated_text = _translate_nigerian_text(source_lang, target_lang, recognized_text)
        except Exception as e:
            print(f"Translation error: {e}", file=sys.stderr)
            return None

    if do_tts:
        tts_lang = resolve_tts_language(NIGERIAN_LANGUAGE_MAP["tts"][target_lang], engine)
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
# 6. INTERACTIVE CLI
# ─────────────────────────────────────────────────────────────────────────────

def speech_to_speech_interactive():
    supported = NIGERIAN_LANGUAGE_MAP["stt"].keys()
    print(f"Supported languages: {', '.join(supported)}\n")

    source_lang = input("Source language [english]: ").strip().lower() or "english"
    target_lang = input("Target language [yoruba]: ").strip().lower() or "yoruba"
    source = input("Input source (mic/file) [mic]: ").strip().lower() or "mic"
    audio_file = None
    if source == "file":
        audio_file = input("Audio file path: ").strip()

    save_output = input("Save output audio? Enter path or leave blank: ").strip() or None

    speech_to_speech(
        source_lang=source_lang,
        target_lang=target_lang,
        source=source,
        audio_file=audio_file,
        save_output=save_output,
        play=True,
        do_tts=True
    )

# ─────────────────────────────────────────────────────────────────────────────
# 7. CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main(argv) -> int:
    parser = argparse.ArgumentParser(description="Nigerian Speech/Text Translation Utility")
    parser.add_argument("--source", required=True, help="Source language (english|hausa|yoruba|igbo|pidgin)")
    parser.add_argument("--target", required=True, help="Target language")
    parser.add_argument("--text", help="Text to translate (skips STT)")
    parser.add_argument("--file", dest="audio_file", help="Audio file path (triggers STT)")
    parser.add_argument("--engine", default="gtts", choices=["gtts", "pyttsx3"])
    parser.add_argument("--save-output", dest="save_output", help="Path to save output audio")
    parser.add_argument("--play", action="store_true", help="Play audio on server")
    parser.add_argument("--tts", action="store_true", help="Enable TTS output")
    args = parser.parse_args(argv)

    try:
        if bool(args.text) == bool(args.audio_file):
            raise ValueError("Provide exactly one of --text or --file.")

        if args.text:
            translated = _translate_nigerian_text(args.source, args.target, args.text)
            if args.tts:
                tts_lang = resolve_tts_language(NIGERIAN_LANGUAGE_MAP["tts"].get(args.target, "en"), args.engine)
                audio_path = text_to_speech_advanced(translated, language=tts_lang, engine=args.engine, play=args.play, save_path=args.save_output)
                print(f"AUDIO:{audio_path}", file=sys.stderr)
            print(translated)
            return 0

        out = speech_to_speech(
            source_lang=args.source,
            target_lang=args.target,
            source="file",
            audio_file=args.audio_file,
            engine=args.engine,
            save_output=args.save_output,
            play=args.play,
            do_tts=args.tts
        )

        if not out:
            raise RuntimeError("Speech pipeline failed.")

        print(out)
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
