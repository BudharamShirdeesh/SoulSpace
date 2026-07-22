import os
import sqlite3
import time
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder="static", template_folder="templates")

# Configuration
UPLOAD_FOLDER = 'uploads'
DATABASE = 'database.db'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mp3', 'pdf', 'txt'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max request payload

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database Helper Functions
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

        # Backward-compatible migration for database schema changes
        existing_cols = [row[1] for row in conn.execute('PRAGMA table_info(posts)').fetchall()]
        if 'canvas_width' not in existing_cols:
            conn.execute('ALTER TABLE posts ADD COLUMN canvas_width REAL DEFAULT 680')
        if 'canvas_height' not in existing_cols:
            conn.execute('ALTER TABLE posts ADD COLUMN canvas_height REAL DEFAULT 400')
        conn.commit()

init_db()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ============================================================
# PAGE ROUTES
# ============================================================
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

# Serve uploaded media/images
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ============================================================
# API ENDPOINTS FOR GLOBAL FEED SHARING
# ============================================================

# 1. GET ALL POSTS (FOR GLOBAL FEED DISPLAY)
@app.route('/api/posts', methods=['GET'])
def get_posts():
    db = get_db()
    cursor = db.execute('SELECT * FROM posts ORDER BY id DESC')
    posts = [dict(row) for row in cursor.fetchall()]
    return jsonify({"status": "success", "posts": posts})

# 2. CREATE A NEW CANVAS POST
@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.get_json()
    if not data or 'html_content' not in data:
        return jsonify({"status": "error", "message": "Missing content"}), 400

    author = data.get('author', '@username')
    avatar_initials = data.get('avatar_initials', 'US')
    formatted_date = data.get('formatted_date', 'Just now')
    bg_color = data.get('bg_color', '#ffffff')
    doodle_layer = data.get('doodle_layer', None)
    html_content = data.get('html_content', '')
    try:
        canvas_width = float(data.get('canvas_width', 680))
        canvas_height = float(data.get('canvas_height', 400))
    except (TypeError, ValueError):
        canvas_width, canvas_height = 680, 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO posts (author, avatar_initials, formatted_date, bg_color, doodle_layer, html_content, canvas_width, canvas_height, likes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (author, avatar_initials, formatted_date, bg_color, doodle_layer, html_content, canvas_width, canvas_height))
        conn.commit()
        post_id = cursor.lastrowid

    return jsonify({"status": "success", "post_id": post_id}), 201

# 3. UPLOAD MEDIA FILES (SAVED TO STORAGE)
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

# 4. LIKE A POST
@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    with get_db() as conn:
        conn.execute('UPDATE posts SET likes = likes + 1 WHERE id = ?', (post_id,))
        conn.commit()
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
