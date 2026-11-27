import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from calculations import run_markov_simulation, validate_transition_matrix
from components import CHART_PALETTE
from database import create_run, get_matrices, get_simulations


def render() -> None:
    st.title("Markov Simulator")
    st.caption("Step-by-step population simulation using v(k+1) = P × v(k).")

    sims = get_simulations()
    if not sims:
        st.warning("Create a simulation in Simulation Manager first.")
        return

    sim_map = {s["name"]: s for s in sims}
    sim_name = st.selectbox("Step 1 – Select Simulation", list(sim_map.keys()))
    sim = sim_map[sim_name]
    states = sim["states"]
    n = len(states)

    mats = get_matrices(sim["id"])
    if not mats:
        st.warning("No saved transition matrices for this simulation. Create one in Matrix Builder.")
        return

    mat_map = {f"{m['matrix_name']} ({m['generation_type']})": m for m in mats}
    mat_label = st.selectbox("Step 2 – Select Transition Matrix", list(mat_map.keys()))
    matrix_obj = mat_map[mat_label]
    valid, errors, _ = validate_transition_matrix(matrix_obj["matrix_data"])
    if not valid:
        st.error("; ".join(errors))
        return

    st.subheader("Step 3 – Initial Population Distribution v(0)")
    mode_label = st.radio("Input Mode", ["Probability Distribution (sum = 1)", "Actual Population Counts"], horizontal=True)
    mode = "probability" if mode_label.startswith("Probability") else "counts"

    cols = st.columns(n)
    v0 = []
    for i, state in enumerate(states):
        default_val = round(1.0 / n, 4) if mode == "probability" else 1000.0
        v0.append(cols[i].number_input(state, min_value=0.0, value=default_val, key=f"v0_{sim['id']}_{i}_{mode}"))

    total_v0 = sum(v0)
    st.write(f"**Total Initial Population:** {total_v0:.4f}" if mode == "probability" else f"**Total Initial Population:** {total_v0:,.2f}")

    if mode == "probability" and abs(total_v0 - 1.0) > 1e-4:
        st.error("Probability distribution must sum to 1.0000.")
        return
    if total_v0 <= 0:
        st.error("Total population must be greater than 0.")
        return

    iterations = st.slider("Step 4 – Number of Time Periods", min_value=1, max_value=100, value=10)

    if st.button("Step 5 – Run Simulation", type="primary"):
        with st.spinner("Computing Markov steps..."):
            res = run_markov_simulation(matrix_obj["matrix_data"], v0, iterations, mode)
            st.session_state["sim_result"] = {
                "sim": sim,
                "matrix": matrix_obj,
                "v0": v0,
                "iterations": iterations,
                "results": res,
            }

    if "sim_result" in st.session_state:
        data = st.session_state["sim_result"]
        res = data["results"]
        st.subheader("Step 6 – Simulation Results")
        traj_df = pd.DataFrame(res["trajectory"], columns=states)
        traj_df.index.name = "Step"

        fig = go.Figure()
        for idx, s_name in enumerate(states):
            fig.add_trace(
                go.Scatter(
                    x=list(range(len(res["trajectory"]))),
                    y=traj_df[s_name],
                    mode="lines+markers",
                    name=s_name,
                    line=dict(color=CHART_PALETTE[idx % len(CHART_PALETTE)], width=2.5),
                )
            )
        fig.update_layout(paper_bgcolor="#FFFCF6", plot_bgcolor="#FFFCF6", xaxis_title="Step", yaxis_title="Value")
        st.plotly_chart(fig, use_container_width=True)
        st.dataframe(traj_df, use_container_width=True)

        if st.button("Step 7 – Save Results to SQLite", type="primary"):
            create_run(
                data["sim"]["id"],
                data["matrix"]["id"],
                {"mode": mode, "values": data["v0"]},
                data["iterations"],
                res,
            )
            st.success("Simulation run saved to markov_lab.db!")
