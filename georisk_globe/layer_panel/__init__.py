import os
import streamlit.components.v1 as components

layer_panel = components.declare_component(
    "georisk_layer_panel",
    path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
)
