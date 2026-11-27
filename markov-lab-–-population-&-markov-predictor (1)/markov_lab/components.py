import streamlit as st

COLORS = {
    "linen": "#F5F0E6",
    "navy": "#10233F",
    "amber": "#F5A623",
    "warm_white": "#FFFCF6",
    "muted_blue": "#4D83A8",
    "text": "#292724",
}

CHART_PALETTE = ["#10233F", "#F5A623", "#4D83A8", "#2E7D6B", "#B65A3A", "#6F5A8E"]


def inject_custom_css() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Poppins:wght@500;600;700&display=swap');

        .stApp {
            background-color: #F5F0E6;
            color: #292724;
            font-family: 'Inter', sans-serif;
        }
        h1, h2, h3 {
            font-family: 'Poppins', sans-serif;
            color: #10233F;
        }
        section[data-testid="stSidebar"] {
            background-color: #10233F;
        }
        section[data-testid="stSidebar"] * {
            color: #F5F0E6;
        }
        .markov-card {
            background-color: #FFFCF6;
            border: 1px solid #E5DEC9;
            border-radius: 12px;
            padding: 1.25rem;
            box-shadow: 0 2px 10px rgba(16, 35, 63, 0.05);
            margin-bottom: 1rem;
        }
        .stButton > button[kind="primary"] {
            background-color: #F5A623;
            color: #10233F;
            font-weight: 600;
            border: none;
            border-radius: 8px;
        }
        .stButton > button {
            border-radius: 8px;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
