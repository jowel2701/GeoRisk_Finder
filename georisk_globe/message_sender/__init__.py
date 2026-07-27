import os
import streamlit.components.v1 as components

_message_sender = components.declare_component(
    "georisk_message_sender",
    path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
)


def message_sender(layers, view_state, key=None):
    return _message_sender(layers=layers, view_state=view_state, key=key, default=None)
