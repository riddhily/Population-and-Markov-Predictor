# Markov Lab – Population & Markov Predictor

An academic Markov Chain simulation, matrix analysis, and population predictor application backed by local SQLite persistence (`markov_lab.db`).

## Features
- **Dashboard**: Real-time SQLite metrics, overview trajectory chart, latest simulation summary, recent activity, and quick actions.
- **Simulation Manager**: Create, edit, and delete population models with dynamic state categories.
- **Matrix Builder**: Manual entry and automatic valid column-stochastic matrix generation with live column-sum validation.
- **Markov Simulator**: 7-step guided simulation supporting both normalized probability distributions and raw population counts (`v(k+1) = P × v(k)`).
- **Mathematical Analysis**: Eigenvalues, eigenvectors, complex unit-circle spectrum, steady-state equilibrium validation, diagonalisation (`P = V D V⁻¹`), and multi-run/matrix comparisons.
- **History & Help**: Searchable simulation run archive and student-friendly Markov theory reference.

## Local Python / Streamlit Execution
```bash
cd markov_lab
pip install -r requirements.txt
streamlit run app.py
```

The application automatically creates `markov_lab.db` using Python's built-in `sqlite3` module on first launch—no external database server or XAMPP installation required.
