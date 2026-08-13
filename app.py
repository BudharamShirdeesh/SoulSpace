import os
import sqlite3
import time
import mimetypes
import json
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from groq import Groq

app = Flask(__name__, static_folder="static", template_folder="templates")

# Configuration
UPLOAD_FOLDER = 'uploads'
DATABASE = 'database.db'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'webm', 'ogg', 'mp3', 'wav', 'pdf', 'txt'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max request payload

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize Groq Client
groq_api_key = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author TEXT NOT NULL,
                avatar_initials TEXT NOT NULL,
                formatted_date TEXT NOT NULL,
                bg_color TEXT NOT NULL,
                doodle_layer TEXT,
                html_content TEXT NOT NULL,
                canvas_width REAL DEFAULT 680,
                canvas_height REAL DEFAULT 400,
                likes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

        existing_cols = [row[1] for row in conn.execute('PRAGMA table_info(posts)').fetchall()]
        if 'canvas_width' not in existing_cols:
            conn.execute('ALTER TABLE posts ADD COLUMN canvas_width REAL DEFAULT 680')
        if 'canvas_height' not in existing_cols:
            conn.execute('ALTER TABLE posts ADD COLUMN canvas_height REAL DEFAULT 400')
        conn.commit()

init_db()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# PAGE ROUTES
@app.route('/')
@app.route('/homepage.html')
def index():
    return render_template('homepage.html')

@app.route('/auth.html')
def auth_page():
    return render_template('auth.html')

@app.route('/landing.html')
def feed_page():
    return render_template('landing.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    mime_mapping = {
        'mov': 'video/quicktime',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    }
    mimetype = mime_mapping.get(ext) or mimetypes.guess_type(filename)[0]
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, mimetype=mimetype)

# API ENDPOINTS
@app.route('/api/posts', methods=['GET'])
def get_posts():
    db = get_db()
    cursor = db.execute('SELECT * FROM posts ORDER BY id DESC')
    posts = [dict(row) for row in cursor.fetchall()]
    return jsonify({"status": "success", "posts": posts})

@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.get_json() or {}
    if not data or 'html_content' not in data:
        return jsonify({"status": "error", "message": "Missing content"}), 400

    author = data.get('author', '@username')
    avatar_initials = data.get('avatar_initials', 'US')
    formatted_date = data.get('formatted_date', 'Just now')
    bg_color = data.get('bg_color', '#ffffff')
    doodle_layer = data.get('doodle_layer', None)
    html_content = data.get('html_content', '')
    try:
        canvas_width = float(data.get('canvas_width', 1000))
        canvas_height = float(data.get('canvas_height', 500))
    except (TypeError, ValueError):
        canvas_width, canvas_height = 1000, 500

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO posts (author, avatar_initials, formatted_date, bg_color, doodle_layer, html_content, canvas_width, canvas_height, likes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (author, avatar_initials, formatted_date, bg_color, doodle_layer, html_content, canvas_width, canvas_height))
        conn.commit()
        post_id = cursor.lastrowid

    return jsonify({"status": "success", "post_id": post_id}), 201

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file attached"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = f"{int(time.time())}_{secure_filename(file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        file_url = f"/uploads/{filename}"
        return jsonify({"status": "success", "url": file_url})

    return jsonify({"status": "error", "message": "File type not permitted"}), 400

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    with get_db() as conn:
        conn.execute('UPDATE posts SET likes = likes + 1 WHERE id = ?', (post_id,))
        conn.commit()
    return jsonify({"status": "success"})

# AI AUTO-ORGANIZE ENDPOINT
@app.route('/api/ai-organize', methods=['POST'])
def ai_organize():
    data = request.get_json() or {}
    elements = data.get('elements', [])
    custom_prompt = data.get('custom_prompt', '')

    if not elements:
        return jsonify({"status": "error", "message": "No canvas elements found"}), 400

    categories = {
        "Documents": [],
        "Images": [],
        "Text Notes": [],
        "Videos": [],
        "Audio Files": []
    }

    raw_texts = []

    for el in elements:
        item_type = str(el.get('type', 'text')).lower()
        item_src = str(el.get('src', '')).lower()
        item_text = str(el.get('text', '')).strip()

        # Strict Audio Classification
        if item_type == 'audio' or 'audio' in item_src or any(ext in item_src for ext in ['.mp3', '.wav', '.ogg', '.m4a', '.aac']):
            el['type'] = 'audio'
            categories["Audio Files"].append(el)
        # Strict Video Classification
        elif item_type == 'video' or ('video' in item_src and 'audio' not in item_src) or any(ext in item_src for ext in ['.mp4', '.mov', '.webm']):
            el['type'] = 'video'
            categories["Videos"].append(el)
        elif item_type == 'image' or any(ext in item_src for ext in ['.jpg', '.png', '.jpeg', '.gif', '.webp']):
            el['type'] = 'image'
            categories["Images"].append(el)
        elif item_type == 'file' or any(ext in item_src for ext in ['.pdf', '.doc', '.docx', '.txt']):
            el['type'] = 'file'
            categories["Documents"].append(el)
        else:
            el['type'] = 'text'
            categories["Text Notes"].append(el)
            if item_text and len(item_text) > 1:
                raw_texts.append(item_text)

    active_categories = {k: v for k, v in categories.items() if len(v) > 0}

    # Force Groq ONLY to rewrite grammar for text notes (Caption generation completely removed)
    if groq_client and raw_texts:
        try:
            prompt_text = (
                "You are an expert English grammar editor. Analyze these user text notes: " + json.dumps(raw_texts) + "\n"
                "Return a JSON object with one key:\n"
                "'corrected_notes': An array containing each text note rewritten into proper, polished English grammar.\n"
                "Output ONLY valid JSON."
            )

            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a JSON generator. Respond strictly in valid JSON format."},
                    {"role": "user", "content": prompt_text}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )

            ai_res = json.loads(completion.choices[0].message.content)
            corrected_notes = ai_res.get('corrected_notes', [])

            if "Text Notes" in active_categories and len(corrected_notes) == len(active_categories["Text Notes"]):
                for i, item in enumerate(active_categories["Text Notes"]):
                    item['text'] = corrected_notes[i]

        except Exception as err:
            print("Groq Grammar Error:", err)

    options = [
        {
            "id": "option-1",
            "title": "Categorized Workspace",
            "description": "Organized into Media, Videos, Audio, Documents, and Text Notes",
            "categories": active_categories
        },
        {
            "id": "option-2",
            "title": "Format Breakdown",
            "description": "Clean functional grouping",
            "categories": active_categories
        },
        {
            "id": "option-3",
            "title": "Priority Overview",
            "description": "Organized workspace items",
            "categories": active_categories
        }
    ]

    return jsonify({"status": "success", "options": options})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
