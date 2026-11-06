# A planter bed of leafy greens (#365), first person; the bed or rack and its plants are in models/_crops.py.
# Run: blender -b --factory-startup -P models/planter_bed.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import build
from _crops import planter_bed

build("planter_bed", planter_bed("leafyGreens"))
