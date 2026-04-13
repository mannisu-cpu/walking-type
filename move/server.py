from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return "Server is running 🚀"

@app.route("/scrape")
def scrape():
    url = request.args.get("url")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/111.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(url, headers=headers, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")

        # ❗删除无用标签
        for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            tag.decompose()

        # ✅ 优先抓 article
        article = soup.find("article")

        if article:
            paragraphs = article.find_all("p")
        else:
            # fallback：抓所有 p
            paragraphs = soup.find_all("p")

        text = "\n\n".join([p.get_text().strip() for p in paragraphs])

        return jsonify({
            "text": text[:20000]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
