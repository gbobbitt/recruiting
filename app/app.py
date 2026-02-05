# HTTP SERVER

import json

from flask import Flask, request
from flask_cors import CORS
from simulator import Simulator
from store import QRangeStore
import logging
from datetime import datetime
from flask_pydantic import validate
from models import ActorProfileDTO, SimulationDTO
from simulationgraph import SimulationGraph
import modsim
from database import db, Profile, Simulation


############################## Application Configuration ##############################


app = Flask(__name__)
CORS(app, origins=["http://localhost:3030"])
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"

db.init_app(app)

with app.app_context():
    db.create_all()

logging.basicConfig(level=logging.INFO)


############################## Simulation State ##############################


_sim_graph_cache: dict[str, SimulationGraph] = {}


############################## API Endpoints ##############################


@app.get("/")
def health():
    return "<p>Sedaro Nano API - running!</p>"


@app.get("/schema/agent")
def get_agent_schema():
    return {}


@app.get("/schema/statemanagers")
def get_state_managers_schema():
    return {"stateManagers": modsim.schema}


@app.get("/profiles")
def get_profiles():
    profiles = Profile.query.order_by(Profile.id).all()
    if profiles:
        return {"profiles": [{"id": profile.id, "profile": profile.data} for profile in profiles]}
    else:
        return {"error": "Profile not found"}, 404


@app.post("/profile/<profile_id>/load")
@validate()
def load_profile(profile_id: str):
    actor_profile = Profile.query.filter_by(id=profile_id).first()
    if not actor_profile:
        return {"error": "Profile not found"}, 404

    profile_data = json.loads(actor_profile.data)
    profile_dto = ActorProfileDTO.model_validate(profile_data)

    t = datetime.now()
    loaded_sim_graph = SimulationGraph(profile_dto.actors)
    logging.info(f"Time to Load: {datetime.now() - t}")

    _sim_graph_cache[profile_id] = loaded_sim_graph

    return {"id": profile_id, "profile": profile_dto, "status": "loaded"}


@app.put("/profile/<profile_id>")
@validate()
def set_profile(profile_id: str, profile: ActorProfileDTO):
    t = datetime.now()
    loaded_sim_graph = SimulationGraph(profile.actors)
    logging.info(f"Time to Build: {datetime.now() - t}")

    _sim_graph_cache[profile_id] = loaded_sim_graph

    actor_profile = Profile.query.filter_by(id=profile_id).first()
    if actor_profile:
        actor_profile.data = json.dumps(profile.model_dump())
    else:
        actor_profile = Profile(id=profile_id, data=json.dumps(profile.model_dump()))
        db.session.add(actor_profile)
    
    db.session.commit()
    return {"id": profile_id, "status": "saved"}


@app.get("/profile/<profile_id>/simulations")
def get_data(profile_id: str):
    simulations = Simulation.query.filter_by(profile_id=profile_id).order_by(Simulation.id).all()
    if simulations:
        return {"simulations": [{"id": sim.id, "data": sim.data} for sim in simulations]}
    else:
        return {"error": "No simulations found for this profile"}, 404


@app.post("/profile/<profile_id>/simulation")
@validate()
def simulate(profile_id: str, profile: SimulationDTO):
    loaded_sim_graph = _sim_graph_cache.get(profile_id)
    if loaded_sim_graph is None:
        logging.error("Attempted to run simulation with no loaded actors")
        return {"error": "No actors loaded"}, 400

    # Create store and simulator
    store = QRangeStore()
    simulator = Simulator(store=store, sim_graph=loaded_sim_graph, initial_states=profile.initial_states)

    # Run simulation
    t = datetime.now()
    simulator.simulate()
    logging.info(f"Time to Simulate: {datetime.now() - t}")

    # Save data to database
    simulation = Simulation(data=json.dumps(store.store))
    db.session.add(simulation)
    db.session.commit()

    return store.store
