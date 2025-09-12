from fastapi import FastAPI
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI()

@app.get("/")
def root():
    return {"message": "AI service running"}

@app.post("/match")
def match(job_desc: str, resumes: list[str]):
    # TF-IDF similarity
    docs = [job_desc] + resumes
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(docs)
    cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()

    results = [{"resume": resumes[i], "score": float(cosine_sim[i])}
               for i in range(len(resumes))]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
