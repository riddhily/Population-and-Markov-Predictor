import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from components import CHART_PALETTE
from database import get_dashboard_summary


def render() -> None:
    st.markdown(
        "<h1 style='font-family:Playfair Display,serif;color:#10233F;margin-bottom:0.2rem;'>Welcome to Markov Lab!</h1>"
        "<p style='color:#4A463F;margin-bottom:1.25rem;'>Explore Markov Chains, predict population changes and analyse long-term behaviour.</p>",
        unsafe_allow_html=True,
    )

    summary = get_dashboard_summary()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Simulations", summary["total_simulations"])
    c2.metric("Completed Runs", summary["completed_runs"])
    c3.metric("Saved Matrices", summary["saved_matrices"])
    last_time = summary["recent_activity"][0]["created_at"] if summary["recent_activity"] else "No activity"
    c4.metric("Last Activity", last_time)

    col_left, col_right = st.columns([7, 5])
    latest = summary["latest_run"]

    with col_left:
        st.subheader("Simulation Overview")
        if latest:
            fig = go.Figure()
            norm_traj = latest["results"]["normalizedTrajectory"]
            steps = [f"Step {i}" for i in range(len(norm_traj))]
            for idx, state_name in enumerate(latest["states"]):
                fig.add_trace(
                    go.Scatter(
                        x=steps,
                        y=[row[idx] for row in norm_traj],
                        mode="lines+markers",
                        name=state_name,
                        line=dict(color=CHART_PALETTE[idx % len(CHART_PALETTE)], width=2.5),
                    )
                )
            fig.update_layout(
                paper_bgcolor="#FFFCF6",
                plot_bgcolor="#FFFCF6",
                yaxis=dict(range=[0, 1.05], title="State Share"),
                margin=dict(l=40, r=20, t=30, b=35),
                height=300,
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No completed runs saved in SQLite yet. Create a simulation or run the Markov Simulator.")

    with col_right:
        st.subheader("Latest Simulation")
        if latest:
            st.write(f"**Name:** {latest['simulation_name']}")
            st.write(f"**States:** {len(latest['states'])} ({', '.join(latest['states'])})")
            st.write(f"**Steps:** {latest['iterations']}")
            st.write(f"**Date:** {latest['created_at']}")
            st.success("Simulation Completed Successfully!")
            if st.button("View Results", type="primary", use_container_width=True):
                st.session_state["loaded_run"] = latest
                st.session_state["current_page"] = "Markov Simulator"
                st.rerun()
        else:
            st.info("Run your first simulation to see its summary here.")

    col_act, col_qa = st.columns([7, 5])
    with col_act:
        st.subheader("Recent Activity")
        if summary["recent_activity"]:
            df = pd.DataFrame(summary["recent_activity"])
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.caption("No SQLite activity recorded yet.")

    with col_qa:
        st.subheader("Quick Actions")
        qa1, qa2, qa3 = st.columns(3)
        if qa1.button("Create Simulation", use_container_width=True):
            st.session_state["current_page"] = "Simulation Manager"
            st.rerun()
        if qa2.button("Build Matrix", use_container_width=True, type="primary"):
            st.session_state["current_page"] = "Matrix Builder"
            st.rerun()
        if qa3.button("Run Simulator", use_container_width=True):
            st.session_state["current_page"] = "Markov Simulator"
            st.rerun()
