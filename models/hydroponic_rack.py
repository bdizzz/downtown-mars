# A hydroponic rack of leafy greens (#365), first person; the bed or rack and its plants are in models/_crops.py.
# Run: blender -b --factory-startup -P models/hydroponic_rack.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crops import hydroponic_rack

build("hydroponic_rack", hydroponic_rack("leafyGreens"))
