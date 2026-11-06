# A hydroponic rack of soybeans (#365), first person; the bed or rack and its plants are in models/_crops.py.
# Run: blender -b --factory-startup -P models/hydroponic_rack_soybeans.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crops import hydroponic_rack

build("hydroponic_rack_soybeans", hydroponic_rack("soybeans"))
