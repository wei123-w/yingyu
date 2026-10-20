"""英语 VS 本机静态文件与 Windows 语音服务。"""

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parent
MAX_SPEECH_LENGTH = 500
SPEECH_TIMEOUT_SECONDS = 20
MAX_AI_REQUEST_BYTES = 25 * 1024 * 1024
AI_REQUEST_TIMEOUT_SECONDS = 90


def validate_speech_text(text):
    cleaned = str(text or "").strip()
    if not cleaned:
        raise ValueError("朗读内容不能为空。")
    if len(cleaned) > MAX_SPEECH_LENGTH:
        raise ValueError(f"朗读内容不能超过 {MAX_SPEECH_LENGTH} 个字符。")
    return cleaned


def synthesize_speech(text):
    """调用 Windows 系统语音生成 WAV，并优先选择英语女声。"""
    if sys.platform != "win32":
        raise RuntimeError("本机语音回退仅适用于 Windows，请使用浏览器自带语音。")

    powershell = shutil.which("powershell.exe") or shutil.which("powershell")
    if not powershell:
        raise RuntimeError("找不到 Windows PowerShell，无法启动本机语音服务。")

    script = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $englishVoices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' })
    $voice = $englishVoices | Where-Object { $_.VoiceInfo.Gender.ToString() -eq 'Female' } | Sort-Object { if ($_.VoiceInfo.Name -match 'Zira|Aria|Jenny') { 0 } else { 1 } } | Select-Object -First 1
    if ($null -eq $voice) { $voice = $englishVoices | Select-Object -First 1 }
    if ($null -eq $voice) { throw '未安装英语语音。请在 Windows 语音设置中添加英语语音。' }
    $synth.SelectVoice($voice.VoiceInfo.Name)
    $synth.Rate = 0
    $synth.Volume = 100
    $synth.SetOutputToWaveFile($env:ENGLISH_VS_SPEECH_OUTPUT)
    $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:ENGLISH_VS_SPEECH_TEXT))
    $synth.Speak($text)
    [Console]::Out.Write($voice.VoiceInfo.Name)
} finally {
    $synth.Dispose()
}
"""

    script_argument = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    environment = os.environ.copy()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wave_file:
        output_path = wave_file.name
    environment["ENGLISH_VS_SPEECH_OUTPUT"] = output_path
    environment["ENGLISH_VS_SPEECH_TEXT"] = base64.b64encode(text.encode("utf-8")).decode("ascii")

    try:
        result = subprocess.run(
            [powershell, "-NoProfile", "-NonInteractive", "-EncodedCommand", script_argument],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=SPEECH_TIMEOUT_SECONDS,
            env=environment,
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "未知系统语音错误").strip()
            raise RuntimeError(f"Windows 语音合成失败：{detail[-500:]}")
        audio = Path(output_path).read_bytes()
        if len(audio) < 44 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            raise RuntimeError("Windows 语音服务未生成有效的 WAV 音频。")
        return audio
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Windows 语音合成超时，请稍后重试。") from error
    finally:
        try:
            os.remove(output_path)
        except FileNotFoundError:
            pass


class SpeechRequestHandler(SimpleHTTPRequestHandler):
    """提供网页静态文件、本机语音接口与 AI 请求转发。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path != "/api/speech":
            return super().do_GET()

        parameters = parse_qs(parsed.query, keep_blank_values=True)
        try:
            text = validate_speech_text(parameters.get("text", [""])[0])
            audio = synthesize_speech(text)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # 浏览器超时、刷新或关闭页面时可能提前断开；不再尝试写入第二个错误响应。
            return
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
            return
        except (RuntimeError, OSError) as error:
            self._send_json(503, {"error": str(error)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path != "/api/ai/chat/completions":
            self._send_json(404, {"error": "找不到本地接口。"})
            return

        if not self._is_local_request():
            self._send_json(403, {"error": "仅允许本机网页访问此接口。"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "请求长度无效。"})
            return
        if content_length <= 0 or content_length > MAX_AI_REQUEST_BYTES:
            self._send_json(413, {"error": "AI 请求内容为空或超过 25 MB。"})
            return

        try:
            request_data = json.loads(self.rfile.read(content_length).decode("utf-8"))
            endpoint = str(request_data.get("endpoint", "")).strip()
            api_key = str(request_data.get("apiKey", "")).strip()
            payload = request_data.get("payload")
            endpoint_url = urlsplit(endpoint)
            if endpoint_url.scheme != "https" or not endpoint_url.hostname:
                raise ValueError("AI 接口地址必须是有效的 HTTPS 地址。")
            if not api_key or not isinstance(payload, dict):
                raise ValueError("请提供 API 密钥和有效的 AI 请求内容。")
            upstream_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            upstream = urllib.request.Request(
                endpoint,
                data=upstream_body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(upstream, timeout=AI_REQUEST_TIMEOUT_SECONDS) as response:
                    response_body = response.read()
                    status = response.status
                    content_type = response.headers.get("Content-Type", "application/json")
            except urllib.error.HTTPError as error:
                response_body = error.read()
                status = error.code
                content_type = error.headers.get("Content-Type", "application/json")
            self._send_upstream_response(status, content_type, response_body)
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            reason = getattr(error, "reason", error)
            self._send_json(502, {"error": f"无法连接 AI 服务：{reason}"})
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError) as error:
            self._send_json(400, {"error": "AI 请求格式无效。"})

    def _is_local_request(self):
        request_host = urlsplit(f"//{self.headers.get('Host', '')}").hostname
        if request_host not in {"127.0.0.1", "localhost"}:
            return False
        origin = self.headers.get("Origin")
        if not origin:
            return True
        origin_url = urlsplit(origin)
        return (
            origin_url.scheme == "http"
            and origin_url.hostname in {"127.0.0.1", "localhost", "::1"}
            and origin_url.netloc.lower() == self.headers.get("Host", "").lower()
        )

    def _send_upstream_response(self, status, content_type, body):
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # 客户端已离开时，已无法把上游结果送回浏览器。
            return

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 8765), SpeechRequestHandler)
    print("英语 VS 本地服务已启动：http://127.0.0.1:8765")
    print("按 Ctrl+C 停止服务。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n英语 VS 本地服务已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
