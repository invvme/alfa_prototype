from flask import Flask, render_template
import config

app = Flask(__name__)

@app.route("/")
def dashboard():
    return render_template("dashboard.html", project_name=config.PROJECT_NAME)

if __name__ == "__main__":
    app.run(debug=True)