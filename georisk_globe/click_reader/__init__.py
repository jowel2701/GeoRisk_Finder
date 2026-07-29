import os
import streamlit.components.v1 as components

_click_reader = components.declare_component(
    "click_reader",
    path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
)


def click_reader(key=None):
    return _click_reader(key=key, default=None)
