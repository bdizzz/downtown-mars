# A hydroponic rack of potatoes (#365), first person; the bed or rack and its plants are in models/_crops.py.
# Run: blender -b --factory-startup -P models/hydroponic_rack_potatoes.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crops import hydroponic_rack

build("hydroponic_rack_potatoes", hydroponic_rack("potatoes"))
