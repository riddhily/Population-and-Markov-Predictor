import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from calculations import analyze_eigen_and_steady_state
from database import get_matrices, get_runs, get_simulations


def render() -> None:
    st.title("Mathematical Analysis")
    st.caption("Eigenvalues, eigenvectors, steady-state verification, diagonalisation, and comparisons.")

    sims = get_simulations()
    if not sims:
        st.warning("Create a simulation first.")
        return

    sim_map = {s["name"]: s for s in sims}
    sim = sim_map[st.selectbox("Simulation Model", list(sim_map.keys()))]
    mats = get_matrices(sim["id"])
    if not mats:
        st.warning("No matrices saved for this simulation.")
        return

    mat_map = {m["matrix_name"]: m for m in mats}
    mat = mat_map[st.selectbox("Transition Matrix", list(mat_map.keys()))]
    analysis = analyze_eigen_and_steady_state(mat["matrix_data"])

    tab1, tab2, tab3, tab4 = st.tabs(
        ["Eigenvalue Analysis", "Steady-State Analysis", "Diagonalisation", "Visualisation & Comparison"]
    )

    with tab1:
        st.subheader("Eigenvalues & Eigenvectors")
        eig_df = pd.DataFrame(
            {
                "Eigenvalue": [str(np.round(v, 4)) for v in analysis["eigenvalues"]],
                "Modulus |λ|": [round(float(abs(v)), 4) for v in analysis["eigenvalues"]],
            }
        )
        st.dataframe(eig_df, use_container_width=True, hide_index=True)
        st.write("**Eigenvector Matrix (Columns):**")
        st.dataframe(pd.DataFrame(np.round(analysis["eigenvectors"].real, 4), index=sim["states"]))

    with tab2:
        st.subheader("Steady-State Distribution")
        if analysis["is_ergodic"] and analysis["stationary_vector"] is not None:
            st.success("Unique convergent steady-state distribution verified.")
            pi_df = pd.DataFrame({"State": sim["states"], "Steady Share": analysis["stationary_vector"]})
            st.dataframe(pi_df, use_container_width=True, hide_index=True)
            st.caption(f"Residual ||Pπ - π||∞ = {analysis['residual_norm']:.2e}")
        elif analysis["stationary_vector"] is not None:
            st.warning("Chain has a unique stationary vector Pπ = π, but exhibits periodic oscillation.")
        else:
            st.warning("A unique steady state cannot be established (nullity > 1 / multiple absorbing classes).")

    with tab3:
        st.subheader("Diagonalisation (P = V D V⁻¹)")
        if analysis["is_diagonalizable"]:
            st.success(f"Matrix is diagonalizable (reconstruction error: {analysis['reconstruction_error']:.2e}).")
            st.write("**V (Eigenvectors)**")
            st.dataframe(pd.DataFrame(np.round(analysis["V"].real, 4)))
            st.write("**D (Diagonal Eigenvalues)**")
            st.dataframe(pd.DataFrame(np.round(analysis["D"].real, 4)))
        else:
            st.error("Matrix is not diagonalizable (defective eigenspace).")

    with tab4:
        st.subheader("Compare Saved Simulation Runs")
        runs = get_runs(sim["id"])
        if len(runs) < 1:
            st.info("Save runs in Markov Simulator to compare trajectories here.")
        else:
            fig = go.Figure()
            for r in runs[:4]:
                traj = r["results"]["normalizedTrajectory"]
                fig.add_trace(
                    go.Scatter(
                        x=list(range(len(traj))),
                        y=[row[0] for row in traj],
                        mode="lines+markers",
                        name=f"Run #{r['id']} ({r['matrix_name']}) - {sim['states'][0]}",
                    )
                )
            fig.update_layout(paper_bgcolor="#FFFCF6", plot_bgcolor="#FFFCF6", yaxis=dict(range=[0, 1.05]))
            st.plotly_chart(fig, use_container_width=True)
