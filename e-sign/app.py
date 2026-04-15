"""E-Sign.ver2 - Flask 앱 팩토리 + 진입점."""
import os
from dotenv import load_dotenv
load_dotenv()  # .env 파일 로드 (SMTP_USER, SMTP_PASS 등)

from flask import Flask, jsonify

from config import UPLOAD_FOLDER, MAX_CONTENT_LENGTH
from blueprints.home import bp as home_bp
from blueprints.sign import bp as sign_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    app.register_blueprint(home_bp)
    app.register_blueprint(sign_bp)

    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.errorhandler(500)
    def handle_500(e):
        if app.debug:
            import traceback
            return jsonify({"ok": False, "error": str(e), "trace": traceback.format_exc()}), 500
        return jsonify({"ok": False, "error": "서버 오류가 발생했습니다."}), 500

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
