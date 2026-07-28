import os
import streamlit.components.v1 as components

_component_func = components.declare_component(
    "georisk_globe",
    path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
)


def georisk_globe_component(payload=None, key=None):
    return _component_func(payload=payload, key=key, default=None)
