import numpy as np
import pandas as pd
import streamlit as st
from calculations import generate_stochastic_matrix, validate_transition_matrix
from database import create_matrix, delete_matrix, get_matrices, get_simulations


def render() -> None:
    st.title("Matrix Builder")
    st.caption("Build manual transition matrices or automatically generate valid column-stochastic matrices.")

    sims = get_simulations()
    if not sims:
        st.warning("Create a simulation in Simulation Manager first.")
        return

    sim_map = {f"{s['name']} ({len(s['states'])} states)": s for s in sims}
    selected_label = st.selectbox("Select Simulation", list(sim_map.keys()))
    sim = sim_map[selected_label]
    states = sim["states"]
    n = len(states)

    method = st.radio("Creation Method", ["A. Manual Matrix Creation", "B. Automatic Matrix Generation"], horizontal=True)
    gen_type = "automatic" if method.startswith("B.") else "manual"

    if gen_type == "automatic":
        profile = st.selectbox("Generation Profile", ["high-retention", "balanced", "high-mobility"])
        if st.button("Generate / Regenerate Valid Matrix", type="primary"):
            st.session_state["mb_grid"] = generate_stochastic_matrix(n, profile)
            st.info("Automatically generated valid column-stochastic matrix. Edit cells below before saving if desired.")

    if "mb_grid" not in st.session_state or len(st.session_state["mb_grid"]) != n:
        st.session_state["mb_grid"] = np.eye(n).tolist()

    df_init = pd.DataFrame(st.session_state["mb_grid"], index=states, columns=states)
    edited_df = st.data_editor(df_init, use_container_width=True)
    matrix_data = edited_df.to_numpy(dtype=float).tolist()

    valid, errors, col_sums = validate_transition_matrix(matrix_data)
    st.write("**Column Sums (must equal 1.0000):**", {states[i]: round(col_sums[i], 4) for i in range(n)})
    if valid:
        st.success("Valid column-stochastic transition matrix.")
    else:
        for err in errors:
            st.error(err)

    matrix_name = st.text_input("Matrix Name", value=f"{sim['name']} – {'Auto' if gen_type == 'automatic' else 'Manual'} Matrix")
    if st.button("Save Transition Matrix", type="primary", disabled=not valid):
        create_matrix(sim["id"], matrix_name, matrix_data, gen_type)
        st.success(f"Saved '{matrix_name}' to SQLite.")
        st.rerun()

    st.divider()
    st.subheader("Saved Transition Matrices")
    mats = get_matrices(sim["id"])
    for m in mats:
        with st.expander(f"{m['matrix_name']} ({m['generation_type'].title()})"):
            st.dataframe(pd.DataFrame(m["matrix_data"], index=states, columns=states))
            if st.button("Delete Matrix", key=f"del_mat_{m['id']}"):
                delete_matrix(m["id"])
                st.rerun()
