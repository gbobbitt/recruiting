
from pydantic import BaseModel
from typing import Callable, NamedTuple


############################## Models ##############################


class Vector3(NamedTuple):
    x: float
    y: float
    z: float


class StateManagerModel(BaseModel):
    consumed: str
    produced: str
    function: Callable


############################## DTOs ##############################


class ActorStateDTO(BaseModel):
    position: Vector3
    velocity: Vector3
    mass: float


class StateManagerDTO(BaseModel):
    consumed: str
    produced: str
    function: str


class ActorDTO(BaseModel):
    id: str
    state_managers: list[StateManagerDTO]


class ActorProfileDTO(BaseModel):
    actors: list[ActorDTO]


class SimulationDTO(BaseModel):
    initial_states: dict[str, ActorStateDTO]
