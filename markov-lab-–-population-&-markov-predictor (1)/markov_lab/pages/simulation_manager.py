import streamlit as st
from database import create_simulation, delete_simulation, get_simulations, update_simulation


def render() -> None:
    st.title("Simulation Manager")
    st.caption("Create, edit, and manage population models and their state categories.")

    if "sm_states" not in st.session_state:
        st.session_state["sm_states"] = ["Urban Population", "Rural Population", "Migrated Population"]

    col_form, col_list = st.columns([5, 7])

    with col_form:
        st.subheader("Create / Edit Simulation")
        sims = get_simulations()
        edit_options = ["Create New"] + [f"#{s['id']} - {s['name']}" for s in sims]
        mode = st.selectbox("Mode", edit_options)
        editing_sim = None if mode == "Create New" else sims[edit_options.index(mode) - 1]

        name = st.text_input("Simulation Name", value=editing_sim["name"] if editing_sim else "")
        desc = st.text_area("Description", value=editing_sim["description"] if editing_sim else "")

        if editing_sim and st.session_state.get("sm_last_edit") != editing_sim["id"]:
            st.session_state["sm_states"] = list(editing_sim["states"])
            st.session_state["sm_last_edit"] = editing_sim["id"]

        st.markdown("**Population States**")
        updated_states = []
        for idx, state_val in enumerate(st.session_state["sm_states"]):
            c_in, c_rm = st.columns([5, 1])
            val = c_in.text_input(f"State {idx + 1}", value=state_val, key=f"st_{idx}", label_visibility="collapsed")
            updated_states.append(val)
            if c_rm.button("✕", key=f"rm_{idx}") and len(st.session_state["sm_states"]) > 2:
                st.session_state["sm_states"].pop(idx)
                st.rerun()

        st.session_state["sm_states"] = updated_states
        if st.button("+ Add State"):
            st.session_state["sm_states"].append(f"State {len(st.session_state['sm_states']) + 1}")
            st.rerun()

        if st.button("Save Simulation", type="primary", use_container_width=True):
            clean = [s.strip() for s in st.session_state["sm_states"] if s.strip()]
            if not name.strip() or len(clean) < 2:
                st.error("Provide a simulation name and at least 2 non-empty states.")
            else:
                if editing_sim:
                    update_simulation(editing_sim["id"], name, desc, clean)
                    st.success(f"Updated '{name}' in SQLite.")
                else:
                    create_simulation(name, desc, clean)
                    st.success(f"Created '{name}' in SQLite.")
                st.rerun()

    with col_list:
        st.subheader("Saved Simulations")
        sims = get_simulations()
        if not sims:
            st.info("No simulations saved yet.")
        for sim in sims:
            with st.expander(f"{sim['name']} ({len(sim['states'])} states)", expanded=True):
                st.write(sim["description"] or "No description.")
                st.write("**States:** " + ", ".join(sim["states"]))
                st.caption(f"Matrices: {sim['matrix_count']} | Runs: {sim['run_count']}")
                if st.checkbox(f"Confirm deletion of '{sim['name']}'", key=f"chk_del_{sim['id']}"):
                    if st.button("Delete Simulation", key=f"del_{sim['id']}"):
                        delete_simulation(sim["id"])
                        st.success(f"Deleted '{sim['name']}'.")
                        st.rerun()
