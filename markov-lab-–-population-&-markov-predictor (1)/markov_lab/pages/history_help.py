import streamlit as st
from database import delete_run, get_runs, get_simulations


def render() -> None:
    st.title("History & Help")
    tab_hist, tab_help = st.tabs(["Simulation History", "Help & Theory Guide"])

    with tab_hist:
        st.subheader("Saved Simulations")
        sims = get_simulations()
        for s in sims:
            st.write(f"- **{s['name']}** ({', '.join(s['states'])}) — Created {s['created_at']}")

        st.subheader("Past Simulation Runs")
        runs = get_runs()
        if not runs:
            st.info("No saved simulation runs yet.")
        for r in runs:
            with st.expander(f"Run #{r['id']} — {r['simulation_name']} ({r['created_at']})"):
                st.write(f"**Matrix:** {r['matrix_name']} | **Iterations:** {r['iterations']}")
                st.write("**Final Distribution:**", r["results"]["finalDistribution"])
                if st.checkbox("Confirm delete run", key=f"chk_run_{r['id']}"):
                    if st.button("Delete Run", key=f"del_run_{r['id']}"):
                        delete_run(r["id"])
                        st.rerun()

    with tab_help:
        st.subheader("Understanding Markov Lab")
        st.markdown(
            """
            - **What is a Markov Chain?** A discrete-time stochastic process where future state probabilities depend only on the current state distribution.
            - **What is a Transition Matrix (P)?** Under the column-vector convention, entry `P[i, j]` is the probability of moving from column state `j` to row state `i`. Every column sums to `1`.
            - **Initial Population Distributions:** Either normalized probability shares summing to `1` or actual population headcounts.
            - **How the Simulator Works:** Repeatedly computes `v(k+1) = P × v(k)` for the chosen number of iterations.
            - **Eigenvalues & Eigenvectors:** Dominant eigenvalue `λ₁ = 1` reflects conservation; smaller subdominant moduli `|λ₂| < 1` produce faster convergence.
            - **Steady-State Distribution (π):** The equilibrium vector satisfying `Pπ = π` and `Σπᵢ = 1`.
            """
        )
