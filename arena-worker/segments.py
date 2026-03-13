"""Compute demographic segment breakdowns from classified personas."""


def _acc(map_: dict, key: str, sentiment: str):
    if not key or key in ("undefined", "null", "None", ""):
        return
    if key not in map_:
        map_[key] = {"count": 0, "positive": 0, "negative": 0, "neutral": 0}
    entry = map_[key]
    entry["count"] += 1
    entry[sentiment] += 1


def _to_list(map_: dict) -> list[dict]:
    return sorted(
        [{"label": k, **v} for k, v in map_.items()],
        key=lambda x: x["count"],
        reverse=True,
    )


_CLUSTER_MACRO = {"P": "Progressista", "M": "Moderado", "C": "Conservador", "T": "Transversal"}


def _bucket_eco(score: float) -> str:
    if score <= -0.5:
        return "Esquerda Forte"
    if score <= -0.1:
        return "Centro-Esquerda"
    if score <= 0.1:
        return "Centro"
    if score <= 0.5:
        return "Centro-Direita"
    return "Direita Forte"


def _bucket_cost(score: float) -> str:
    if score <= -0.5:
        return "Progressista Forte"
    if score <= -0.1:
        return "Progressista"
    if score <= 0.1:
        return "Centro"
    if score <= 0.5:
        return "Conservador"
    return "Conservador Forte"


class SegmentAccumulator:
    def __init__(self):
        self._gender = {}
        self._religion = {}
        self._race = {}
        self._region = {}
        self._generation = {}
        self._social_class = {}
        self._education = {}
        self._political = {}
        self._archetype = {}
        self._cluster_macro = {}
        self._score_eco = {}
        self._score_cost = {}

    def add(self, persona: dict, sentiment: str):
        _acc(self._gender, persona.get("gender_identity") or persona.get("gender") or "Outros", sentiment)
        _acc(self._religion, persona.get("macro_religion") or "Outros", sentiment)

        race = persona.get("raca_cor")
        if not race:
            demo = persona.get("demographic_json") or {}
            ib = demo.get("identidade_basica") or {}
            race = ib.get("etnia")
        _acc(self._race, race or "Nao informado", sentiment)

        _acc(self._region, persona.get("region_br") or "Outros", sentiment)
        _acc(self._generation, persona.get("generation") or "Outros", sentiment)

        sc = persona.get("social_class")
        _acc(self._social_class, f"Classe {sc}" if sc else "Outros", sentiment)

        _acc(self._education, persona.get("education_level") or "Outros", sentiment)
        _acc(self._political, persona.get("political_leaning") or "Outros", sentiment)

        # Archetype cluster fields
        arch = persona.get("archetype_primary")
        if arch:
            _acc(self._archetype, arch, sentiment)

        cid = persona.get("cluster_id") or ""
        if cid and cid[0] in _CLUSTER_MACRO:
            _acc(self._cluster_macro, _CLUSTER_MACRO[cid[0]], sentiment)

        score_eco = persona.get("score_economico")
        if isinstance(score_eco, (int, float)):
            _acc(self._score_eco, _bucket_eco(score_eco), sentiment)

        score_cost = persona.get("score_costumes")
        if isinstance(score_cost, (int, float)):
            _acc(self._score_cost, _bucket_cost(score_cost), sentiment)

    def to_dict(self) -> dict:
        return {
            "gender": _to_list(self._gender),
            "religion": _to_list(self._religion),
            "race": _to_list(self._race),
            "region": _to_list(self._region),
            "generation": _to_list(self._generation),
            "socialClass": _to_list(self._social_class),
            "education": _to_list(self._education),
            "politicalLeaning": _to_list(self._political),
            "archetype": _to_list(self._archetype),
            "clusterMacro": _to_list(self._cluster_macro),
            "scoreEco": _to_list(self._score_eco),
            "scoreCost": _to_list(self._score_cost),
        }
