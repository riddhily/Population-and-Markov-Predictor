import streamlit as st
from components import inject_custom_css
from database import check_connection, init_db
from pages import (
    dashboard,
    history_help,
    markov_simulator,
    mathematical_analysis,
    matrix_builder,
    simulation_manager,
)

st.set_page_config(
    page_title="Markov Lab – Population & Markov Predictor",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

init_db()
inject_custom_css()

PAGES = [
    "Dashboard",
    "Simulation Manager",
    "Matrix Builder",
    "Markov Simulator",
    "Mathematical Analysis",
    "History & Help",
]

if "current_page" not in st.session_state:
    st.session_state["current_page"] = "Dashboard"

with st.sidebar:
    st.markdown(
        "<h2 style='font-family:Playfair Display,serif;color:#FFFFFF;text-align:center;margin-bottom:0;'>MARKOV LAB</h2>"
        "<p style='font-family:Playfair Display,serif;font-style:italic;color:#E8DFCE;text-align:center;font-size:0.9rem;'>Population &amp; Markov Predictor</p><hr style='border-color:rgba(255,255,255,0.2);'/>",
        unsafe_allow_html=True,
    )
    selected = st.radio("Navigation", PAGES, index=PAGES.index(st.session_state["current_page"]), label_visibility="collapsed")
    st.session_state["current_page"] = selected
    st.markdown(
        "<hr style='border-color:rgba(255,255,255,0.2);'/>"
        "<p style='text-align:center;font-family:Playfair Display,serif;font-style:italic;'>v(k+1) = P &times; v(k)</p>"
        "<p style='text-align:center;font-size:0.75rem;color:#D5CCB9;'>Linen &middot; Navy &middot; Amber</p>",
        unsafe_allow_html=True,
    )

col_title, col_status = st.columns([4, 1])
with col_status:
    if check_connection():
        st.success("SQLite Connected", icon="🟢")
    else:
        st.error("SQLite Disconnected")

page = st.session_state["current_page"]
if page == "Dashboard":
    dashboard.render()
elif page == "Simulation Manager":
    simulation_manager.render()
elif page == "Matrix Builder":
    matrix_builder.render()
elif page == "Markov Simulator":
    markov_simulator.render()
elif page == "Mathematical Analysis":
    mathematical_analysis.render()
elif page == "History & Help":
    history_help.render()
