from sentence_transformers import SentenceTransformer

# Load model globally to avoid reloading on every request
# all-MiniLM-L6-v2 is fast and produces 384-dimensional embeddings
model = SentenceTransformer('all-MiniLM-L6-v2')

class AIService:
    @staticmethod
    def generate_embedding(text: str) -> list[float]:
        """
        Generate a vector embedding for a given text using a local sentence-transformer model.
        """
        # encode returns a numpy array, convert it to a python list
        embedding = model.encode(text)
        return embedding.tolist()

    @staticmethod
    def construct_searchable_text(event_type: str, payload: dict) -> str:
        """
        Construct a semantic representation of the event.
        e.g., 'payment_failed amount 120 status declined'
        """
        parts = [event_type.replace('_', ' ')]
        for key, value in payload.items():
            parts.append(f"{key} {value}")
        return " ".join(parts)

ai_service = AIService()
