"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringkeys = exports.InventoryEnum = exports.matchTimeElapsed = exports.SIM_TICK_TIME = exports.aiUnspawns = exports.aiSpawns = exports.Cameras = exports.Types = exports.WorldIconImages = exports.ArmorTypes = exports.InventorySlots = exports.ScoreboardType = exports.VehicleList = exports.SoldierClass = exports.SpawnModes = exports.SoldierStateNumber = exports.SoldierStateVector = exports.SoldierStateBool = exports.UIButtonEvent = exports.UIDepth = exports.InventoryModifiers = exports.UIImageType = exports.MoveSpeed = exports.Stance = exports.UIAnchor = exports.UIBgFill = exports.RestrictedInputs = exports.uiRoot = exports.winningTeam = exports.VehicleStateVector = exports.Maps = exports.MiscGadgets = exports.Throwables = exports.MeleeWeapons = exports.OpenGadgets = exports.Gadgets = exports.MusicParams = exports.MusicPackages = exports.MusicEvents = exports.VoiceOverFlags = exports.VoiceOverEvents2D = exports.RuntimeSpawn_Aftermath = exports.RuntimeSpawn_Abbasid = exports.RuntimeSpawn_Common = exports.WeaponAttachments = exports.Weapons = exports.SecondaryWeapons = exports.PrimaryWeapons = void 0;
exports.UIImageTypeToString = UIImageTypeToString;
exports.GetObjId = GetObjId;
exports.GetObjectPosition = GetObjectPosition;
exports.rotationMatrixToEuler = rotationMatrixToEuler;
exports.eulerToRotationMatrix = eulerToRotationMatrix;
exports.GetObjectRotation = GetObjectRotation;
exports.GetTeam = GetTeam;
exports.EndGameMode = EndGameMode;
exports.GetSpawner = GetSpawner;
exports.SpawnAIFromAISpawner = SpawnAIFromAISpawner;
exports.CreateAI = CreateAI;
exports.DestroyAI = DestroyAI;
exports.Loop = Loop;
exports.ArmMCOM = ArmMCOM;
exports.GetPlayersOnPoint = GetPlayersOnPoint;
exports.Reset = Reset;
exports.Message = Message;
exports.DisplayNotificationMessage = DisplayNotificationMessage;
exports.SendErrorReport = SendErrorReport;
exports.GetUIRoot = GetUIRoot;
exports.CreateVector = CreateVector;
exports.CreateTransform = CreateTransform;
exports.SetObjectTransform = SetObjectTransform;
exports.AddUIText = AddUIText;
exports.AddUIText16 = AddUIText16;
exports.AddUIContainer = AddUIContainer;
exports.AddUIButton = AddUIButton;
exports.AddUIImage = AddUIImage;
exports.SetUIWidgetDepth = SetUIWidgetDepth;
exports.GetUIWidgetName = GetUIWidgetName;
exports.SetUIWidgetPosition = SetUIWidgetPosition;
exports.SetUIButtonEnabled = SetUIButtonEnabled;
exports.DeleteAllUIWidgets = DeleteAllUIWidgets;
exports.EnableUIInputMode = EnableUIInputMode;
exports.DeleteUIWidget = DeleteUIWidget;
exports.FindUIWidgetWithName = FindUIWidgetWithName;
exports.SetUIWidgetName = SetUIWidgetName;
exports.SetUIWidgetVisible = SetUIWidgetVisible;
exports.SetUIWidgetSize = SetUIWidgetSize;
exports.SetUITextLabel = SetUITextLabel;
exports.SetUITextColor = SetUITextColor;
exports.SetUITextAlpha = SetUITextAlpha;
exports.DumpUITree = DumpUITree;
exports.SetGameModeTimeLimit = SetGameModeTimeLimit;
exports.GetGameModeTimeLimit = GetGameModeTimeLimit;
exports.PauseGameModeTime = PauseGameModeTime;
exports.GetRoundTime = GetRoundTime;
exports.GetGameModeScore = GetGameModeScore;
exports.SetScoreboardType = SetScoreboardType;
exports.SetSpawnMode = SetSpawnMode;
exports.SetScoreboardHeader = SetScoreboardHeader;
exports.SetScoreboardColumnNames = SetScoreboardColumnNames;
exports.SetScoreboardColumnWidths = SetScoreboardColumnWidths;
exports.SetScoreboardSorting = SetScoreboardSorting;
exports.SetScoreboardPlayerValues = SetScoreboardPlayerValues;
exports.SkipManDown = SkipManDown;
exports.GetMCOM = GetMCOM;
exports.GetSpatialObject = GetSpatialObject;
exports.EnableGameModeObjective = EnableGameModeObjective;
exports.SetMCOMFuseTime = SetMCOMFuseTime;
exports.GetCapturePoint = GetCapturePoint;
exports.GetCurrentOwnerTeam = GetCurrentOwnerTeam;
exports.GetPreviousOwnerTeam = GetPreviousOwnerTeam;
exports.SetCapturePointCapturingTime = SetCapturePointCapturingTime;
exports.SetCapturePointNeutralizationTime = SetCapturePointNeutralizationTime;
exports.SetCapturePointOwner = SetCapturePointOwner;
exports.SetMaxCaptureMultiplier = SetMaxCaptureMultiplier;
exports.GetCaptureProgress = GetCaptureProgress;
exports.GetOwnerProgressTeam = GetOwnerProgressTeam;
exports.GetHQ = GetHQ;
exports.EnableHQ = EnableHQ;
exports.GetSector = GetSector;
exports.AISetUnspawnOnDead = AISetUnspawnOnDead;
exports.AIDefendPositionBehavior = AIDefendPositionBehavior;
exports.AIMoveToBehavior = AIMoveToBehavior;
exports.AISetMoveSpeed = AISetMoveSpeed;
exports.AISetStance = AISetStance;
exports.WaitTimeout = WaitTimeout;
exports.Wait = Wait;
exports.GetSoldierState = GetSoldierState;
exports.SetTeam = SetTeam;
exports.EnableAllPlayerDeploy = EnableAllPlayerDeploy;
exports.DeployPlayer = DeployPlayer;
exports.EnablePlayerDeploy = EnablePlayerDeploy;
exports.UndeployPlayer = UndeployPlayer;
exports.IsSoldierClass = IsSoldierClass;
exports.ForceRevive = ForceRevive;
exports.Kill = Kill;
exports.SetPlayerMaxHealth = SetPlayerMaxHealth;
exports.SetAIToHumanDamageModifier = SetAIToHumanDamageModifier;
exports.SpotTarget = SpotTarget;
exports.SetUITextSize = SetUITextSize;
exports.SetUITextAnchor = SetUITextAnchor;
exports.SetUIWidgetBgColor = SetUIWidgetBgColor;
exports.SetUIWidgetBgFill = SetUIWidgetBgFill;
exports.SetUIWidgetBgAlpha = SetUIWidgetBgAlpha;
exports.GetMatchTimeElapsed = GetMatchTimeElapsed;
exports.GetMatchTimeRemaining = GetMatchTimeRemaining;
exports.CreatePlayer = CreatePlayer;
exports.EmptyArray = EmptyArray;
exports.CountOf = CountOf;
exports.ValueInArray = ValueInArray;
exports.AppendToArray = AppendToArray;
exports.AddPlayerObsolete = AddPlayerObsolete;
exports.RemovePlayer = RemovePlayer;
exports.KillPlayer = KillPlayer;
exports.AllPlayers = AllPlayers;
exports.AllCapturePoints = AllCapturePoints;
exports.AllVehicles = AllVehicles;
exports.IsVehicleOccupied = IsVehicleOccupied;
exports.Teleport = Teleport;
exports.YComponentOf = YComponentOf;
exports.XComponentOf = XComponentOf;
exports.ZComponentOf = ZComponentOf;
exports.SpawnObject = SpawnObject;
exports.UnspawnObject = UnspawnObject;
exports.LoadLevel = LoadLevel;
exports.AllLevelObjects = AllLevelObjects;
exports.GetInteractPoints = GetInteractPoints;
exports.AddPlayer = AddPlayer;
exports.StartGameMode = StartGameMode;
exports.SendPlayerUIButtonEvent = SendPlayerUIButtonEvent;
exports.GetInteractPoint = GetInteractPoint;
exports.EnableInteractPoint = EnableInteractPoint;
exports.GetWorldIcon = GetWorldIcon;
exports.SetWorldIconPosition = SetWorldIconPosition;
exports.SetWorldIconText = SetWorldIconText;
exports.SetWorldIconColor = SetWorldIconColor;
exports.SetWorldIconImage = SetWorldIconImage;
exports.EnableWorldIconImage = EnableWorldIconImage;
exports.EnableWorldIconText = EnableWorldIconText;
exports.SetWorldIconOwner = SetWorldIconOwner;
exports.SpawnPlayerFromSpawnPoint = SpawnPlayerFromSpawnPoint;
exports.CameraSetActive = CameraSetActive;
exports.GlobalVariable = GlobalVariable;
exports.ObjectVariable = ObjectVariable;
exports.SetVariable = SetVariable;
exports.GetVariable = GetVariable;
exports.SetGameModeTargetScore = SetGameModeTargetScore;
exports.Equals = Equals;
exports.And = And;
exports.Or = Or;
exports.Not = Not;
exports.Subtract = Subtract;
exports.RoundToInteger = RoundToInteger;
exports.Modulo = Modulo;
exports.Divide = Divide;
exports.Floor = Floor;
exports.Multiply = Multiply;
exports.Add = Add;
exports.NotEqualTo = NotEqualTo;
exports.RandomValueInArray = RandomValueInArray;
exports.ClosestPlayerTo = ClosestPlayerTo;
exports.IsPlayerValid = IsPlayerValid;
exports.SetPlayerArmorType = SetPlayerArmorType;
exports.RemovePlayerInventoryAtSlot = RemovePlayerInventoryAtSlot;
exports.ReplacePlayerInventory = ReplacePlayerInventory;
exports.SetInventoryAmmo = SetInventoryAmmo;
exports.SetInventoryMagazineAmmo = SetInventoryMagazineAmmo;
exports.ForceSwitchInventory = ForceSwitchInventory;
exports.DistanceBetween = DistanceBetween;
exports.LessThan = LessThan;
exports.LessThanEqualTo = LessThanEqualTo;
exports.GreaterThan = GreaterThan;
exports.IsType = IsType;
exports.SetCameraTypeForAll = SetCameraTypeForAll;
exports.SetSpectateOnDeath = SetSpectateOnDeath;
exports.RayCast = RayCast;
exports.PlaySound = PlaySound;
exports.GetVehicleState = GetVehicleState;
exports.SetGameModeScore = SetGameModeScore;
exports.PlayVO = PlayVO;
exports.IsCurrentMap = IsCurrentMap;
exports.CreateNewWeaponPackage = CreateNewWeaponPackage;
exports.AddAttachmentToWeaponPackage = AddAttachmentToWeaponPackage;
exports.RemoveEquipment = RemoveEquipment;
exports.AddEquipment = AddEquipment;
exports.EnableVFX = EnableVFX;
exports.MoveVFX = MoveVFX;
exports.LoadMusic = LoadMusic;
exports.PlayMusic = PlayMusic;
exports.SetMusicParam = SetMusicParam;
exports.ForcePlayerToSeat = ForcePlayerToSeat;
exports.AISetTarget = AISetTarget;
exports.SetStrings = SetStrings;
// Import weapon-related and audio enums from separate files
const enums_1 = require("./enums");
Object.defineProperty(exports, "PrimaryWeapons", { enumerable: true, get: function () { return enums_1.PrimaryWeapons; } });
Object.defineProperty(exports, "SecondaryWeapons", { enumerable: true, get: function () { return enums_1.SecondaryWeapons; } });
Object.defineProperty(exports, "Weapons", { enumerable: true, get: function () { return enums_1.Weapons; } });
Object.defineProperty(exports, "WeaponAttachments", { enumerable: true, get: function () { return enums_1.WeaponAttachments; } });
Object.defineProperty(exports, "RuntimeSpawn_Common", { enumerable: true, get: function () { return enums_1.RuntimeSpawn_Common; } });
Object.defineProperty(exports, "RuntimeSpawn_Abbasid", { enumerable: true, get: function () { return enums_1.RuntimeSpawn_Abbasid; } });
Object.defineProperty(exports, "RuntimeSpawn_Aftermath", { enumerable: true, get: function () { return enums_1.RuntimeSpawn_Aftermath; } });
Object.defineProperty(exports, "VoiceOverEvents2D", { enumerable: true, get: function () { return enums_1.VoiceOverEvents2D; } });
Object.defineProperty(exports, "VoiceOverFlags", { enumerable: true, get: function () { return enums_1.VoiceOverFlags; } });
Object.defineProperty(exports, "MusicEvents", { enumerable: true, get: function () { return enums_1.MusicEvents; } });
Object.defineProperty(exports, "MusicPackages", { enumerable: true, get: function () { return enums_1.MusicPackages; } });
Object.defineProperty(exports, "MusicParams", { enumerable: true, get: function () { return enums_1.MusicParams; } });
var Gadgets;
(function (Gadgets) {
    Gadgets[Gadgets["CallIn_Air_Strike"] = 200] = "CallIn_Air_Strike";
    Gadgets[Gadgets["CallIn_Ammo_Drop"] = 201] = "CallIn_Ammo_Drop";
    Gadgets[Gadgets["CallIn_Anti_Vehicle_Drop"] = 202] = "CallIn_Anti_Vehicle_Drop";
    Gadgets[Gadgets["CallIn_Artillery_Strike"] = 203] = "CallIn_Artillery_Strike";
    Gadgets[Gadgets["CallIn_Mobile_Redeploy"] = 204] = "CallIn_Mobile_Redeploy";
    Gadgets[Gadgets["CallIn_Smoke_Screen"] = 205] = "CallIn_Smoke_Screen";
    Gadgets[Gadgets["CallIn_UAV_Overwatch"] = 206] = "CallIn_UAV_Overwatch";
    Gadgets[Gadgets["CallIn_Weapon_Drop"] = 207] = "CallIn_Weapon_Drop";
    Gadgets[Gadgets["Class_Adrenaline_Injector"] = 208] = "Class_Adrenaline_Injector";
    Gadgets[Gadgets["Class_Motion_Sensor"] = 209] = "Class_Motion_Sensor";
    Gadgets[Gadgets["Class_Repair_Tool"] = 210] = "Class_Repair_Tool";
    Gadgets[Gadgets["Class_Supply_Bag"] = 211] = "Class_Supply_Bag";
    Gadgets[Gadgets["Deployable_Cover"] = 212] = "Deployable_Cover";
    Gadgets[Gadgets["Deployable_Deploy_Beacon"] = 213] = "Deployable_Deploy_Beacon";
    Gadgets[Gadgets["Deployable_EOD_Bot"] = 214] = "Deployable_EOD_Bot";
    Gadgets[Gadgets["Deployable_Grenade_Intercept_System"] = 215] = "Deployable_Grenade_Intercept_System";
    Gadgets[Gadgets["Deployable_Missile_Intercept_System"] = 216] = "Deployable_Missile_Intercept_System";
    Gadgets[Gadgets["Deployable_Portable_Mortar"] = 217] = "Deployable_Portable_Mortar";
    Gadgets[Gadgets["Deployable_Recon_Drone"] = 218] = "Deployable_Recon_Drone";
    Gadgets[Gadgets["Deployable_Vehicle_Supply_Crate"] = 219] = "Deployable_Vehicle_Supply_Crate";
    Gadgets[Gadgets["Launcher_Aim_Guided"] = 220] = "Launcher_Aim_Guided";
    Gadgets[Gadgets["Launcher_Air_Defense"] = 221] = "Launcher_Air_Defense";
    Gadgets[Gadgets["Launcher_Auto_Guided"] = 222] = "Launcher_Auto_Guided";
    Gadgets[Gadgets["Launcher_Breaching_Projectile"] = 223] = "Launcher_Breaching_Projectile";
    Gadgets[Gadgets["Launcher_High_Explosive"] = 224] = "Launcher_High_Explosive";
    Gadgets[Gadgets["Launcher_Incendiary_Airburst"] = 225] = "Launcher_Incendiary_Airburst";
    Gadgets[Gadgets["Launcher_Long_Range"] = 226] = "Launcher_Long_Range";
    Gadgets[Gadgets["Launcher_Smoke_Grenade"] = 227] = "Launcher_Smoke_Grenade";
    Gadgets[Gadgets["Launcher_Thermobaric_Grenade"] = 228] = "Launcher_Thermobaric_Grenade";
    Gadgets[Gadgets["Launcher_Unguided_Rocket"] = 229] = "Launcher_Unguided_Rocket";
    Gadgets[Gadgets["Melee_Combat_Knife"] = 230] = "Melee_Combat_Knife";
    Gadgets[Gadgets["Melee_Hunting_Knife"] = 231] = "Melee_Hunting_Knife";
    Gadgets[Gadgets["Melee_Sledgehammer"] = 232] = "Melee_Sledgehammer";
    Gadgets[Gadgets["Misc_Acoustic_Sensor_AV_Mine"] = 233] = "Misc_Acoustic_Sensor_AV_Mine";
    Gadgets[Gadgets["Misc_Anti_Personnel_Mine"] = 234] = "Misc_Anti_Personnel_Mine";
    Gadgets[Gadgets["Misc_Anti_Vehicle_Mine"] = 235] = "Misc_Anti_Vehicle_Mine";
    Gadgets[Gadgets["Misc_Assault_Ladder"] = 236] = "Misc_Assault_Ladder";
    Gadgets[Gadgets["Misc_Defibrillator"] = 237] = "Misc_Defibrillator";
    Gadgets[Gadgets["Misc_Demolition_Charge"] = 238] = "Misc_Demolition_Charge";
    Gadgets[Gadgets["Misc_Incendiary_Round_Shotgun"] = 239] = "Misc_Incendiary_Round_Shotgun";
    Gadgets[Gadgets["Misc_Laser_Designator"] = 240] = "Misc_Laser_Designator";
    Gadgets[Gadgets["Misc_Sniper_Decoy"] = 241] = "Misc_Sniper_Decoy";
    Gadgets[Gadgets["Misc_Supply_Pouch"] = 242] = "Misc_Supply_Pouch";
    Gadgets[Gadgets["Misc_Tracer_Dart"] = 243] = "Misc_Tracer_Dart";
    Gadgets[Gadgets["Misc_Tripwire_Sensor_AV_Mine"] = 244] = "Misc_Tripwire_Sensor_AV_Mine";
    Gadgets[Gadgets["Throwable_Anti_Vehicle_Grenade"] = 245] = "Throwable_Anti_Vehicle_Grenade";
    Gadgets[Gadgets["Throwable_Flash_Grenade"] = 246] = "Throwable_Flash_Grenade";
    Gadgets[Gadgets["Throwable_Fragmentation_Grenade"] = 247] = "Throwable_Fragmentation_Grenade";
    Gadgets[Gadgets["Throwable_Incendiary_Grenade"] = 248] = "Throwable_Incendiary_Grenade";
    Gadgets[Gadgets["Throwable_Mini_Frag_Grenade"] = 249] = "Throwable_Mini_Frag_Grenade";
    Gadgets[Gadgets["Throwable_Proximity_Detector"] = 250] = "Throwable_Proximity_Detector";
    Gadgets[Gadgets["Throwable_Smoke_Grenade"] = 251] = "Throwable_Smoke_Grenade";
    Gadgets[Gadgets["Throwable_Stun_Grenade"] = 252] = "Throwable_Stun_Grenade";
    Gadgets[Gadgets["Throwable_Throwing_Knife"] = 253] = "Throwable_Throwing_Knife";
})(Gadgets || (exports.Gadgets = Gadgets = {}));
var OpenGadgets;
(function (OpenGadgets) {
    OpenGadgets[OpenGadgets["UnguidedRocketLauncher"] = 600] = "UnguidedRocketLauncher";
})(OpenGadgets || (exports.OpenGadgets = OpenGadgets = {}));
var MeleeWeapons;
(function (MeleeWeapons) {
    MeleeWeapons[MeleeWeapons["Sledgehammer"] = 300] = "Sledgehammer";
    MeleeWeapons[MeleeWeapons["KaBar"] = 301] = "KaBar";
})(MeleeWeapons || (exports.MeleeWeapons = MeleeWeapons = {}));
var Throwables;
(function (Throwables) {
    Throwables[Throwables["ThrowingKnife"] = 400] = "ThrowingKnife";
    Throwables[Throwables["FragGrenade"] = 401] = "FragGrenade";
    Throwables[Throwables["IncendiaryGrenade"] = 402] = "IncendiaryGrenade";
    Throwables[Throwables["SmokeGrenade"] = 403] = "SmokeGrenade";
    Throwables[Throwables["ProximityGrenade"] = 404] = "ProximityGrenade";
    Throwables[Throwables["ImpactGrenade"] = 405] = "ImpactGrenade";
    Throwables[Throwables["AntiTankGrenade"] = 406] = "AntiTankGrenade";
    Throwables[Throwables["ConcussionGrenade"] = 407] = "ConcussionGrenade";
    Throwables[Throwables["FlashGrenade"] = 408] = "FlashGrenade";
    Throwables[Throwables["MiniV40"] = 409] = "MiniV40";
})(Throwables || (exports.Throwables = Throwables = {}));
var MiscGadgets;
(function (MiscGadgets) {
    MiscGadgets[MiscGadgets["SoftArmor"] = 500] = "SoftArmor";
    MiscGadgets[MiscGadgets["CeramicArmor"] = 501] = "CeramicArmor";
    MiscGadgets[MiscGadgets["AntiVehicleCallin"] = 502] = "AntiVehicleCallin";
    MiscGadgets[MiscGadgets["PowerWeaponsCallin"] = 503] = "PowerWeaponsCallin";
    MiscGadgets[MiscGadgets["SupplyCallin"] = 504] = "SupplyCallin";
    MiscGadgets[MiscGadgets["WeaponCallin"] = 505] = "WeaponCallin";
    MiscGadgets[MiscGadgets["AirStrikeCallin"] = 506] = "AirStrikeCallin";
    MiscGadgets[MiscGadgets["ArtilleryStrikeCallin"] = 507] = "ArtilleryStrikeCallin";
    MiscGadgets[MiscGadgets["KineticStrikeCallin"] = 508] = "KineticStrikeCallin";
    MiscGadgets[MiscGadgets["MobileRespawnCallin"] = 509] = "MobileRespawnCallin";
    MiscGadgets[MiscGadgets["SmokescreenCallin"] = 510] = "SmokescreenCallin";
    MiscGadgets[MiscGadgets["UAVCallin"] = 511] = "UAVCallin";
})(MiscGadgets || (exports.MiscGadgets = MiscGadgets = {}));
var Maps;
(function (Maps) {
    Maps[Maps["Abbasid"] = 0] = "Abbasid";
    Maps[Maps["Aftermath"] = 1] = "Aftermath";
    Maps[Maps["Badlands"] = 2] = "Badlands";
    Maps[Maps["Battery"] = 3] = "Battery";
    Maps[Maps["Capstone"] = 4] = "Capstone";
    Maps[Maps["Dumbo"] = 5] = "Dumbo";
    Maps[Maps["Eastwood"] = 6] = "Eastwood";
    Maps[Maps["Firestorm"] = 7] = "Firestorm";
    Maps[Maps["Granite_ClubHouse"] = 8] = "Granite_ClubHouse";
    Maps[Maps["Granite_MainStreet"] = 9] = "Granite_MainStreet";
    Maps[Maps["Granite_Marina"] = 10] = "Granite_Marina";
    Maps[Maps["Granite_TechCampus"] = 11] = "Granite_TechCampus";
    Maps[Maps["Limestone"] = 12] = "Limestone";
    Maps[Maps["Outskirts"] = 13] = "Outskirts";
    Maps[Maps["Sand"] = 14] = "Sand";
    Maps[Maps["Tungsten"] = 15] = "Tungsten";
})(Maps || (exports.Maps = Maps = {}));
var MedGadgetTypes;
(function (MedGadgetTypes) {
    MedGadgetTypes[MedGadgetTypes["MedKit"] = 600] = "MedKit";
    MedGadgetTypes[MedGadgetTypes["MedicCrate"] = 601] = "MedicCrate";
})(MedGadgetTypes || (MedGadgetTypes = {}));
var VehicleStateVector;
(function (VehicleStateVector) {
    VehicleStateVector[VehicleStateVector["FacingDirection"] = 0] = "FacingDirection";
    VehicleStateVector[VehicleStateVector["LinearVelocity"] = 1] = "LinearVelocity";
    VehicleStateVector[VehicleStateVector["VehiclePosition"] = 2] = "VehiclePosition";
})(VehicleStateVector || (exports.VehicleStateVector = VehicleStateVector = {}));
const spawnerType = 'AI_Spawner';
const spawnPointType = 'SpawnPoint';
const hqType = 'HQ_PlayerSpawner';
const playerSpawnerType = 'PlayerSpawner';
const worldIconType = 'WorldIcon';
const mcomType = 'MCOM';
const interactPointType = 'InteractPoint';
const capturePointType = 'CapturePoint';
const sectorType = 'Sector';
const volumeType = 'PolygonVolume';
class ModArray {
    array = [];
}
const allPlayers = {
    array: [],
};
const allCapturePoints = {
    array: [],
};
const allVehicles = new ModArray();
exports.winningTeam = null;
exports.uiRoot = {
    type: 'UIWidget',
    uiType: 'Container',
    name: 'Root',
    visible: true,
    children: [],
    position: { type: 'Vector', x: 0, y: 0, z: 0 },
};
const initialGameModeTime = -1000;
let gameModeTime = initialGameModeTime; // -1000 hacky way to use gameModeTime for Wait before the game mode starts
let gameModeTimeLimit = 20 * 60;
let gameModeTimePaused = false;
let gameModeTargetScore = 100;
let gameModeScore = Array(16).fill(0);
let scoreboardType;
let mcoms = {};
let aiSpawners = {};
let spawnPoints = {};
let interactPoints = {};
let hqs = {};
let playerSpawners = {};
let worldIcons = {};
let capturePoints = {};
let sectors = {};
let volumes = {};
const zero = CreateVector(0, 0, 0);
var RestrictedInputs;
(function (RestrictedInputs) {
    RestrictedInputs[RestrictedInputs["Zoom"] = 0] = "Zoom";
    RestrictedInputs[RestrictedInputs["Jump"] = 1] = "Jump";
    RestrictedInputs[RestrictedInputs["Sprint"] = 2] = "Sprint";
    RestrictedInputs[RestrictedInputs["Interact"] = 3] = "Interact";
    RestrictedInputs[RestrictedInputs["Reload"] = 4] = "Reload";
    RestrictedInputs[RestrictedInputs["CycleFire"] = 5] = "CycleFire";
    RestrictedInputs[RestrictedInputs["SelectPrimary"] = 6] = "SelectPrimary";
    RestrictedInputs[RestrictedInputs["SelectSecondary"] = 7] = "SelectSecondary";
    RestrictedInputs[RestrictedInputs["SelectCharacterGadget"] = 8] = "SelectCharacterGadget";
    RestrictedInputs[RestrictedInputs["SelectOpenGadget"] = 9] = "SelectOpenGadget";
    RestrictedInputs[RestrictedInputs["MoveLeftRight"] = 10] = "MoveLeftRight";
    RestrictedInputs[RestrictedInputs["FireWeapon"] = 11] = "FireWeapon";
    RestrictedInputs[RestrictedInputs["CameraPitch"] = 12] = "CameraPitch";
    RestrictedInputs[RestrictedInputs["CameraYaw"] = 13] = "CameraYaw";
    RestrictedInputs[RestrictedInputs["Prone"] = 14] = "Prone";
    RestrictedInputs[RestrictedInputs["SelectThrowable"] = 15] = "SelectThrowable";
    RestrictedInputs[RestrictedInputs["MoveForwardBack"] = 16] = "MoveForwardBack";
    RestrictedInputs[RestrictedInputs["SelectMelee"] = 17] = "SelectMelee";
    RestrictedInputs[RestrictedInputs["Crouch"] = 18] = "Crouch";
    RestrictedInputs[RestrictedInputs["CyclePrimary"] = 19] = "CyclePrimary";
})(RestrictedInputs || (exports.RestrictedInputs = RestrictedInputs = {}));
var UIBgFill;
(function (UIBgFill) {
    UIBgFill[UIBgFill["None"] = 0] = "None";
    UIBgFill[UIBgFill["Solid"] = 1] = "Solid";
    UIBgFill[UIBgFill["Blur"] = 2] = "Blur";
    UIBgFill[UIBgFill["OutlineThick"] = 3] = "OutlineThick";
    UIBgFill[UIBgFill["OutlineThin"] = 4] = "OutlineThin";
    UIBgFill[UIBgFill["GradientTop"] = 5] = "GradientTop";
    UIBgFill[UIBgFill["GradientBottom"] = 6] = "GradientBottom";
    UIBgFill[UIBgFill["GradientLeft"] = 7] = "GradientLeft";
    UIBgFill[UIBgFill["GradientRight"] = 8] = "GradientRight";
})(UIBgFill || (exports.UIBgFill = UIBgFill = {}));
var UIAnchor;
(function (UIAnchor) {
    UIAnchor[UIAnchor["TopLeft"] = 0] = "TopLeft";
    UIAnchor[UIAnchor["TopCenter"] = 1] = "TopCenter";
    UIAnchor[UIAnchor["TopRight"] = 2] = "TopRight";
    UIAnchor[UIAnchor["CenterLeft"] = 3] = "CenterLeft";
    UIAnchor[UIAnchor["Center"] = 4] = "Center";
    UIAnchor[UIAnchor["CenterRight"] = 5] = "CenterRight";
    UIAnchor[UIAnchor["BottomLeft"] = 6] = "BottomLeft";
    UIAnchor[UIAnchor["BottomCenter"] = 7] = "BottomCenter";
    UIAnchor[UIAnchor["BottomRight"] = 8] = "BottomRight";
})(UIAnchor || (exports.UIAnchor = UIAnchor = {}));
var Stance;
(function (Stance) {
    Stance[Stance["Stand"] = 0] = "Stand";
    Stance[Stance["Crouch"] = 1] = "Crouch";
    Stance[Stance["Prone"] = 2] = "Prone";
})(Stance || (exports.Stance = Stance = {}));
var MoveSpeed;
(function (MoveSpeed) {
    MoveSpeed[MoveSpeed["InvestigateSlowWalk"] = 0] = "InvestigateSlowWalk";
    MoveSpeed[MoveSpeed["InvestigateWalk"] = 1] = "InvestigateWalk";
    MoveSpeed[MoveSpeed["Patrol"] = 2] = "Patrol";
    MoveSpeed[MoveSpeed["Walk"] = 3] = "Walk";
    MoveSpeed[MoveSpeed["Run"] = 4] = "Run";
    MoveSpeed[MoveSpeed["InvestigateRun"] = 5] = "InvestigateRun";
    MoveSpeed[MoveSpeed["Sprint"] = 6] = "Sprint";
})(MoveSpeed || (exports.MoveSpeed = MoveSpeed = {}));
var UIImageType;
(function (UIImageType) {
    UIImageType[UIImageType["None"] = 0] = "None";
    UIImageType[UIImageType["TEMP_PortalIcon"] = 1] = "TEMP_PortalIcon";
    UIImageType[UIImageType["CrownSolid"] = 2] = "CrownSolid";
    UIImageType[UIImageType["CrownOutline"] = 3] = "CrownOutline";
    UIImageType[UIImageType["C4"] = 4] = "C4";
    UIImageType[UIImageType["ATMine"] = 5] = "ATMine";
    UIImageType[UIImageType["MedicBag"] = 6] = "MedicBag";
    UIImageType[UIImageType["Panzerfaust3"] = 7] = "Panzerfaust3";
    UIImageType[UIImageType["DeployableCover"] = 8] = "DeployableCover";
    UIImageType[UIImageType["TUGS"] = 9] = "TUGS";
    UIImageType[UIImageType["SupplyBag"] = 10] = "SupplyBag";
    UIImageType[UIImageType["Defibrillator"] = 11] = "Defibrillator";
    UIImageType[UIImageType["AmmoCrate"] = 12] = "AmmoCrate";
    UIImageType[UIImageType["PistolAmmo"] = 13] = "PistolAmmo";
    UIImageType[UIImageType["RifleAmmo"] = 14] = "RifleAmmo";
    UIImageType[UIImageType["SelfHeal"] = 15] = "SelfHeal";
    UIImageType[UIImageType["SpawnBeacon"] = 16] = "SpawnBeacon";
    UIImageType[UIImageType["QuestionMark"] = 17] = "QuestionMark";
    UIImageType[UIImageType["KORD6P67"] = 18] = "KORD6P67";
    UIImageType[UIImageType["M240B"] = 19] = "M240B";
    UIImageType[UIImageType["SVChChukavin"] = 20] = "SVChChukavin";
    UIImageType[UIImageType["SVD"] = 21] = "SVD";
    UIImageType[UIImageType["M24"] = 22] = "M24";
    UIImageType[UIImageType["M4A2"] = 23] = "M4A2";
    UIImageType[UIImageType["Cobra_RCE"] = 24] = "Cobra_RCE";
    UIImageType[UIImageType["AKS74U"] = 25] = "AKS74U";
    UIImageType[UIImageType["Mossberg"] = 26] = "Mossberg";
    UIImageType[UIImageType["M98B"] = 27] = "M98B";
    UIImageType[UIImageType["M39EMR"] = 28] = "M39EMR";
    UIImageType[UIImageType["M249"] = 29] = "M249";
    UIImageType[UIImageType["M416"] = 30] = "M416";
    UIImageType[UIImageType["MP7A2"] = 31] = "MP7A2";
    UIImageType[UIImageType["XM8C"] = 32] = "XM8C";
    UIImageType[UIImageType["XM8"] = 33] = "XM8";
    UIImageType[UIImageType["XM8LMG"] = 34] = "XM8LMG";
    UIImageType[UIImageType["MP9"] = 35] = "MP9";
    UIImageType[UIImageType["PKP"] = 36] = "PKP";
    UIImageType[UIImageType["SCARH"] = 37] = "SCARH";
    UIImageType[UIImageType["PP2000"] = 38] = "PP2000";
    UIImageType[UIImageType["AN94"] = 39] = "AN94";
    UIImageType[UIImageType["P90"] = 40] = "P90";
    UIImageType[UIImageType["AK12"] = 41] = "AK12";
})(UIImageType || (exports.UIImageType = UIImageType = {}));
function UIImageTypeToString(type) {
    return UIImageType[type];
}
var InventoryModifiers;
(function (InventoryModifiers) {
    InventoryModifiers[InventoryModifiers["M4A1_SCP_RMR"] = 0] = "M4A1_SCP_RMR";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_TrijiconMRO"] = 1] = "M4A1_SCP_TrijiconMRO";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_TrijiconSDO"] = 2] = "M4A1_SCP_TrijiconSDO";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_TrijiconVCOG"] = 3] = "M4A1_SCP_TrijiconVCOG";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_NX81"] = 4] = "M4A1_SCP_NX81";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_Mark4M2"] = 5] = "M4A1_SCP_Mark4M2";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_VortexM157"] = 6] = "M4A1_SCP_VortexM157";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_VZOR3"] = 7] = "M4A1_SCP_VZOR3";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_1P781P"] = 8] = "M4A1_SCP_1P781P";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_Tango6T"] = 9] = "M4A1_SCP_Tango6T";
    InventoryModifiers[InventoryModifiers["M4A1_BTM_MSBS"] = 10] = "M4A1_BTM_MSBS";
    InventoryModifiers[InventoryModifiers["M4A1_FlashHider"] = 11] = "M4A1_FlashHider";
    InventoryModifiers[InventoryModifiers["M4A1_BRL_ExtendedBarrel"] = 12] = "M4A1_BRL_ExtendedBarrel";
    InventoryModifiers[InventoryModifiers["M4A1_MAG_FastReload"] = 13] = "M4A1_MAG_FastReload";
    InventoryModifiers[InventoryModifiers["M4A1_SCP_XPS3"] = 14] = "M4A1_SCP_XPS3";
    InventoryModifiers[InventoryModifiers["MPX_BTM_EvoHandStop"] = 15] = "MPX_BTM_EvoHandStop";
    InventoryModifiers[InventoryModifiers["MPX_MAG_ExtendedMag"] = 16] = "MPX_MAG_ExtendedMag";
    InventoryModifiers[InventoryModifiers["MPX_FastDeploy"] = 17] = "MPX_FastDeploy";
    InventoryModifiers[InventoryModifiers["MPX_MoveAccuracy"] = 18] = "MPX_MoveAccuracy";
    InventoryModifiers[InventoryModifiers["MPX_SCP_OPK-7Extended"] = 19] = "MPX_SCP_OPK-7Extended";
    InventoryModifiers[InventoryModifiers["M2010_SCP_Mark4M5A2"] = 20] = "M2010_SCP_Mark4M5A2";
    InventoryModifiers[InventoryModifiers["M2010_MAG_ExtendedMag"] = 21] = "M2010_MAG_ExtendedMag";
    InventoryModifiers[InventoryModifiers["M2010_MZL_AACTitanQD"] = 22] = "M2010_MZL_AACTitanQD";
    InventoryModifiers[InventoryModifiers["M2010_GRP_CVLIFE"] = 23] = "M2010_GRP_CVLIFE";
})(InventoryModifiers || (exports.InventoryModifiers = InventoryModifiers = {}));
var UIDepth;
(function (UIDepth) {
    UIDepth[UIDepth["BelowGameUI"] = 0] = "BelowGameUI";
    UIDepth[UIDepth["AboveGameUI"] = 1] = "AboveGameUI";
})(UIDepth || (exports.UIDepth = UIDepth = {}));
var UIButtonEvent;
(function (UIButtonEvent) {
    UIButtonEvent[UIButtonEvent["ButtonDown"] = 0] = "ButtonDown";
    UIButtonEvent[UIButtonEvent["ButtonUp"] = 1] = "ButtonUp";
    UIButtonEvent[UIButtonEvent["FocusIn"] = 2] = "FocusIn";
    UIButtonEvent[UIButtonEvent["FocusOut"] = 3] = "FocusOut";
    UIButtonEvent[UIButtonEvent["HoverIn"] = 4] = "HoverIn";
    UIButtonEvent[UIButtonEvent["HoverOut"] = 5] = "HoverOut";
})(UIButtonEvent || (exports.UIButtonEvent = UIButtonEvent = {}));
var SoldierStateBool;
(function (SoldierStateBool) {
    SoldierStateBool[SoldierStateBool["IsAlive"] = 0] = "IsAlive";
    SoldierStateBool[SoldierStateBool["IsBeingRevived"] = 1] = "IsBeingRevived";
    SoldierStateBool[SoldierStateBool["IsCrouching"] = 2] = "IsCrouching";
    SoldierStateBool[SoldierStateBool["IsDead"] = 3] = "IsDead";
    SoldierStateBool[SoldierStateBool["IsFiring"] = 4] = "IsFiring";
    SoldierStateBool[SoldierStateBool["IsInAir"] = 5] = "IsInAir";
    SoldierStateBool[SoldierStateBool["IsInteracting"] = 6] = "IsInteracting";
    SoldierStateBool[SoldierStateBool["IsInWater"] = 7] = "IsInWater";
    SoldierStateBool[SoldierStateBool["IsJumping"] = 8] = "IsJumping";
    SoldierStateBool[SoldierStateBool["IsManDown"] = 9] = "IsManDown";
    SoldierStateBool[SoldierStateBool["IsOnGround"] = 10] = "IsOnGround";
    SoldierStateBool[SoldierStateBool["IsParachuting"] = 11] = "IsParachuting";
    SoldierStateBool[SoldierStateBool["IsProne"] = 12] = "IsProne";
    SoldierStateBool[SoldierStateBool["IsReloading"] = 13] = "IsReloading";
    SoldierStateBool[SoldierStateBool["IsReviving"] = 14] = "IsReviving";
    SoldierStateBool[SoldierStateBool["IsSprinting"] = 15] = "IsSprinting";
    SoldierStateBool[SoldierStateBool["IsStanding"] = 16] = "IsStanding";
    SoldierStateBool[SoldierStateBool["IsVaulting"] = 17] = "IsVaulting";
    SoldierStateBool[SoldierStateBool["IsZooming"] = 18] = "IsZooming";
    SoldierStateBool[SoldierStateBool["IsAISoldier"] = 19] = "IsAISoldier";
    SoldierStateBool[SoldierStateBool["IsInVehicle"] = 20] = "IsInVehicle";
})(SoldierStateBool || (exports.SoldierStateBool = SoldierStateBool = {}));
var SoldierStateVector;
(function (SoldierStateVector) {
    SoldierStateVector[SoldierStateVector["GetLinearVelocity"] = 50] = "GetLinearVelocity";
    SoldierStateVector[SoldierStateVector["GetPosition"] = 51] = "GetPosition";
    SoldierStateVector[SoldierStateVector["GetFacingDirection"] = 52] = "GetFacingDirection";
    SoldierStateVector[SoldierStateVector["EyePosition"] = 53] = "EyePosition";
})(SoldierStateVector || (exports.SoldierStateVector = SoldierStateVector = {}));
var SoldierStateNumber;
(function (SoldierStateNumber) {
    SoldierStateNumber[SoldierStateNumber["CurrentHealth"] = 100] = "CurrentHealth";
    SoldierStateNumber[SoldierStateNumber["Speed"] = 101] = "Speed";
    SoldierStateNumber[SoldierStateNumber["MaxHealth"] = 102] = "MaxHealth";
    SoldierStateNumber[SoldierStateNumber["NormalizedHealth"] = 103] = "NormalizedHealth";
    SoldierStateNumber[SoldierStateNumber["CurrentWeaponAmmo"] = 104] = "CurrentWeaponAmmo";
    SoldierStateNumber[SoldierStateNumber["CurrentWeaponMagazineAmmo"] = 105] = "CurrentWeaponMagazineAmmo";
})(SoldierStateNumber || (exports.SoldierStateNumber = SoldierStateNumber = {}));
var SpawnModes;
(function (SpawnModes) {
    SpawnModes[SpawnModes["Deploy"] = 0] = "Deploy";
    SpawnModes[SpawnModes["AutoSpawn"] = 1] = "AutoSpawn";
    SpawnModes[SpawnModes["Spectating"] = 2] = "Spectating";
})(SpawnModes || (exports.SpawnModes = SpawnModes = {}));
var SoldierClass;
(function (SoldierClass) {
    SoldierClass[SoldierClass["Assault"] = 0] = "Assault";
    SoldierClass[SoldierClass["Recon"] = 1] = "Recon";
    SoldierClass[SoldierClass["Engineer"] = 2] = "Engineer";
    SoldierClass[SoldierClass["Support"] = 3] = "Support";
})(SoldierClass || (exports.SoldierClass = SoldierClass = {}));
var VehicleList;
(function (VehicleList) {
    VehicleList[VehicleList["Abrams"] = 0] = "Abrams";
    VehicleList[VehicleList["Leopard"] = 1] = "Leopard";
    VehicleList[VehicleList["Cheetah"] = 2] = "Cheetah";
    VehicleList[VehicleList["CV90"] = 3] = "CV90";
    VehicleList[VehicleList["Gepard"] = 4] = "Gepard";
    VehicleList[VehicleList["Stationary_BGM71TOW"] = 5] = "Stationary_BGM71TOW";
    VehicleList[VehicleList["Stationary_GDF009"] = 6] = "Stationary_GDF009";
    VehicleList[VehicleList["M2MG"] = 7] = "M2MG";
    VehicleList[VehicleList["UH60"] = 8] = "UH60";
    VehicleList[VehicleList["MH6M"] = 9] = "MH6M";
    VehicleList[VehicleList["Eurocopter"] = 10] = "Eurocopter";
    VehicleList[VehicleList["AH6M"] = 11] = "AH6M";
    VehicleList[VehicleList["Helicopter_AH64E"] = 12] = "Helicopter_AH64E";
    VehicleList[VehicleList["CWS_SPIKE"] = 13] = "CWS_SPIKE";
    VehicleList[VehicleList["CWS_HMG"] = 14] = "CWS_HMG";
    VehicleList[VehicleList["CWS_AGL"] = 15] = "CWS_AGL";
    VehicleList[VehicleList["CWS"] = 16] = "CWS";
    VehicleList[VehicleList["Vector"] = 17] = "Vector";
    VehicleList[VehicleList["Quadbike"] = 18] = "Quadbike";
    VehicleList[VehicleList["PTV"] = 19] = "PTV";
    VehicleList[VehicleList["Marauder"] = 20] = "Marauder";
    VehicleList[VehicleList["Flyer60"] = 21] = "Flyer60";
    VehicleList[VehicleList["RHIB"] = 22] = "RHIB";
    VehicleList[VehicleList["MQ9"] = 23] = "MQ9";
    VehicleList[VehicleList["JAS39"] = 24] = "JAS39";
    VehicleList[VehicleList["F22"] = 25] = "F22";
    VehicleList[VehicleList["F16"] = 26] = "F16";
})(VehicleList || (exports.VehicleList = VehicleList = {}));
var ScoreboardType;
(function (ScoreboardType) {
    ScoreboardType[ScoreboardType["NotSet"] = 0] = "NotSet";
    ScoreboardType[ScoreboardType["DefaultFFA"] = 1] = "DefaultFFA";
    ScoreboardType[ScoreboardType["Off"] = 2] = "Off";
    ScoreboardType[ScoreboardType["CustomTwoTeams"] = 3] = "CustomTwoTeams";
    ScoreboardType[ScoreboardType["CustomFFA"] = 4] = "CustomFFA";
})(ScoreboardType || (exports.ScoreboardType = ScoreboardType = {}));
var InventorySlots;
(function (InventorySlots) {
    InventorySlots[InventorySlots["PrimaryWeapon"] = 1000] = "PrimaryWeapon";
    InventorySlots[InventorySlots["SecondaryWeapon"] = 1001] = "SecondaryWeapon";
    InventorySlots[InventorySlots["GadgetOne"] = 1002] = "GadgetOne";
    InventorySlots[InventorySlots["GadgetTwo"] = 1003] = "GadgetTwo";
    InventorySlots[InventorySlots["Throwable"] = 1004] = "Throwable";
    InventorySlots[InventorySlots["MeleeWeapon"] = 1005] = "MeleeWeapon";
    InventorySlots[InventorySlots["ClassGadget"] = 1006] = "ClassGadget";
    InventorySlots[InventorySlots["MiscGadget"] = 1007] = "MiscGadget";
})(InventorySlots || (exports.InventorySlots = InventorySlots = {}));
var ArmorTypes;
(function (ArmorTypes) {
    ArmorTypes[ArmorTypes["NoArmor"] = 0] = "NoArmor";
    ArmorTypes[ArmorTypes["SoftArmor"] = 1] = "SoftArmor";
    ArmorTypes[ArmorTypes["CeramicArmor"] = 2] = "CeramicArmor";
})(ArmorTypes || (exports.ArmorTypes = ArmorTypes = {}));
var WorldIconImages;
(function (WorldIconImages) {
    WorldIconImages[WorldIconImages["Skull"] = 0] = "Skull";
    WorldIconImages[WorldIconImages["Assist"] = 1] = "Assist";
    WorldIconImages[WorldIconImages["SquadPing"] = 2] = "SquadPing";
    WorldIconImages[WorldIconImages["Alert"] = 3] = "Alert";
    WorldIconImages[WorldIconImages["Explosion"] = 4] = "Explosion";
    WorldIconImages[WorldIconImages["BombArmed"] = 5] = "BombArmed";
    WorldIconImages[WorldIconImages["Hazard"] = 6] = "Hazard";
    WorldIconImages[WorldIconImages["Flag"] = 7] = "Flag";
    WorldIconImages[WorldIconImages["Bomb"] = 8] = "Bomb";
    WorldIconImages[WorldIconImages["Diffuse"] = 9] = "Diffuse";
    WorldIconImages[WorldIconImages["EMP"] = 10] = "EMP";
    WorldIconImages[WorldIconImages["DangerPing"] = 11] = "DangerPing";
    WorldIconImages[WorldIconImages["FilledPing"] = 12] = "FilledPing";
    WorldIconImages[WorldIconImages["Cross"] = 13] = "Cross";
    WorldIconImages[WorldIconImages["Triangle"] = 14] = "Triangle";
    WorldIconImages[WorldIconImages["Eye"] = 15] = "Eye";
})(WorldIconImages || (exports.WorldIconImages = WorldIconImages = {}));
var Types;
(function (Types) {
    Types[Types["String"] = 0] = "String";
    Types[Types["Number"] = 1] = "Number";
    Types[Types["Boolean"] = 2] = "Boolean";
    Types[Types["Player"] = 3] = "Player";
    Types[Types["Team"] = 4] = "Team";
    Types[Types["Vector"] = 5] = "Vector";
    Types[Types["Camera"] = 6] = "Camera";
    Types[Types["WaypointPath"] = 7] = "WaypointPath";
    Types[Types["Object"] = 8] = "Object";
    Types[Types["Array"] = 9] = "Array";
    Types[Types["Message"] = 10] = "Message";
    Types[Types["Variable"] = 11] = "Variable";
    Types[Types["Squad"] = 12] = "Squad";
    Types[Types["ModBuilderEnum"] = 13] = "ModBuilderEnum";
    Types[Types["WeaponUnlock"] = 14] = "WeaponUnlock";
    Types[Types["DeathType"] = 15] = "DeathType";
    Types[Types["CapturePoint"] = 16] = "CapturePoint";
    Types[Types["Vehicle"] = 17] = "Vehicle";
    Types[Types["AreaTrigger"] = 18] = "AreaTrigger";
    Types[Types["Objective"] = 19] = "Objective";
    Types[Types["ActionStation"] = 20] = "ActionStation";
    Types[Types["VFX"] = 21] = "VFX";
    Types[Types["InteractPoint"] = 22] = "InteractPoint";
    Types[Types["SpatialObject"] = 23] = "SpatialObject";
    Types[Types["ScreenEffect"] = 24] = "ScreenEffect";
    Types[Types["Spawner"] = 25] = "Spawner";
    Types[Types["SFX"] = 26] = "SFX";
    Types[Types["UIWidget"] = 27] = "UIWidget";
    Types[Types["HQ"] = 28] = "HQ";
    Types[Types["Sector"] = 29] = "Sector";
    Types[Types["DamageType"] = 30] = "DamageType";
    Types[Types["PrefabSpawner"] = 31] = "PrefabSpawner";
    Types[Types["RingOfFire"] = 32] = "RingOfFire";
    Types[Types["SpawnPoint"] = 33] = "SpawnPoint";
    Types[Types["MCOM"] = 34] = "MCOM";
    Types[Types["ScoreboardType"] = 35] = "ScoreboardType";
    Types[Types["WorldIcon"] = 36] = "WorldIcon";
    Types[Types["VehicleSpawner"] = 37] = "VehicleSpawner";
    Types[Types["Transform"] = 38] = "Transform";
    Types[Types["EmplacementSpawner"] = 39] = "EmplacementSpawner";
    Types[Types["Enum_RestrictedInputs"] = 40] = "Enum_RestrictedInputs";
    Types[Types["Enum_InventorySlots"] = 41] = "Enum_InventorySlots";
    Types[Types["Enum_ResupplyTypes"] = 42] = "Enum_ResupplyTypes";
    Types[Types["Enum_Cameras"] = 43] = "Enum_Cameras";
    Types[Types["Enum_SoldierStateBool"] = 44] = "Enum_SoldierStateBool";
    Types[Types["Enum_SoldierStateNumber"] = 45] = "Enum_SoldierStateNumber";
    Types[Types["Enum_SoldierStateVector"] = 46] = "Enum_SoldierStateVector";
    Types[Types["Enum_PrimaryWeapons"] = 47] = "Enum_PrimaryWeapons";
    Types[Types["Enum_SecondaryWeapons"] = 48] = "Enum_SecondaryWeapons";
    Types[Types["Enum_OpenGadgets"] = 49] = "Enum_OpenGadgets";
    Types[Types["Enum_Throwables"] = 50] = "Enum_Throwables";
    Types[Types["Enum_MeleeWeapons"] = 51] = "Enum_MeleeWeapons";
    Types[Types["Enum_MedGadgetTypes"] = 52] = "Enum_MedGadgetTypes";
    Types[Types["Enum_Factions"] = 53] = "Enum_Factions";
    Types[Types["Enum_PlayerDeathTypes"] = 54] = "Enum_PlayerDeathTypes";
    Types[Types["Enum_Maps"] = 55] = "Enum_Maps";
    Types[Types["Enum_VehicleStateVector"] = 56] = "Enum_VehicleStateVector";
    Types[Types["Enum_CapturePoints"] = 57] = "Enum_CapturePoints";
    Types[Types["Enum_VFXTypes"] = 58] = "Enum_VFXTypes";
    Types[Types["Enum_VE"] = 59] = "Enum_VE";
    Types[Types["Enum_SFX"] = 60] = "Enum_SFX";
    Types[Types["Enum_AwarenessState"] = 61] = "Enum_AwarenessState";
    Types[Types["Enum_UIAnchor"] = 62] = "Enum_UIAnchor";
    Types[Types["Enum_PlayerDamageTypes"] = 63] = "Enum_PlayerDamageTypes";
    Types[Types["Enum_UIImageType"] = 64] = "Enum_UIImageType";
    Types[Types["Enum_UIButtonEvent"] = 65] = "Enum_UIButtonEvent";
    Types[Types["Enum_ClassGadgets"] = 66] = "Enum_ClassGadgets";
    Types[Types["Enum_InventoryModifiers"] = 67] = "Enum_InventoryModifiers";
    Types[Types["Enum_VoiceOverEvents2D"] = 68] = "Enum_VoiceOverEvents2D";
    Types[Types["Enum_SoundEvents2D"] = 69] = "Enum_SoundEvents2D";
    Types[Types["Enum_WorldIconImages"] = 70] = "Enum_WorldIconImages";
    Types[Types["Enum_Types"] = 71] = "Enum_Types";
    Types[Types["Enum_UIBgFill"] = 72] = "Enum_UIBgFill";
    Types[Types["Enum_PlayerFilterTypes"] = 73] = "Enum_PlayerFilterTypes";
    Types[Types["Enum_SoundEvents3D"] = 74] = "Enum_SoundEvents3D";
    Types[Types["Enum_VoiceOverEvents3D"] = 75] = "Enum_VoiceOverEvents3D";
    Types[Types["Enum_SpawnModes"] = 76] = "Enum_SpawnModes";
    Types[Types["Enum_ScoreboardType"] = 77] = "Enum_ScoreboardType";
    Types[Types["Enum_MiscGadgets"] = 78] = "Enum_MiscGadgets";
    Types[Types["Enum_ArmorTypes"] = 79] = "Enum_ArmorTypes";
    Types[Types["Enum_ArmorDurability"] = 80] = "Enum_ArmorDurability";
    Types[Types["Enum_UIDepth"] = 81] = "Enum_UIDepth";
    Types[Types["Enum_VehicleList"] = 82] = "Enum_VehicleList";
    Types[Types["Enum_AmmoTypes"] = 83] = "Enum_AmmoTypes";
    Types[Types["Enum_ActionStationAnimation"] = 84] = "Enum_ActionStationAnimation";
    Types[Types["Enum_Stance"] = 85] = "Enum_Stance";
    Types[Types["Enum_MoveSpeed"] = 86] = "Enum_MoveSpeed";
    Types[Types["Enum_SoldierClass"] = 87] = "Enum_SoldierClass";
    Types[Types["Enum_RuntimeSpawn_Common"] = 88] = "Enum_RuntimeSpawn_Common";
    Types[Types["Enum_RuntimeSpawn_Granite_ResidentialNorth"] = 89] = "Enum_RuntimeSpawn_Granite_ResidentialNorth";
    Types[Types["Enum_RuntimeSpawn_Abbasid"] = 90] = "Enum_RuntimeSpawn_Abbasid";
    Types[Types["Enum_RuntimeSpawn_Aftermath"] = 91] = "Enum_RuntimeSpawn_Aftermath";
    Types[Types["Enum_RuntimeSpawn_Badlands"] = 92] = "Enum_RuntimeSpawn_Badlands";
    Types[Types["Enum_RuntimeSpawn_Battery"] = 93] = "Enum_RuntimeSpawn_Battery";
    Types[Types["Enum_RuntimeSpawn_Capstone"] = 94] = "Enum_RuntimeSpawn_Capstone";
    Types[Types["Enum_RuntimeSpawn_Dumbo"] = 95] = "Enum_RuntimeSpawn_Dumbo";
    Types[Types["Enum_RuntimeSpawn_Eastwood"] = 96] = "Enum_RuntimeSpawn_Eastwood";
    Types[Types["Enum_RuntimeSpawn_FireStorm"] = 97] = "Enum_RuntimeSpawn_FireStorm";
    Types[Types["Enum_RuntimeSpawn_Limestone"] = 98] = "Enum_RuntimeSpawn_Limestone";
    Types[Types["Enum_RuntimeSpawn_Outskirts"] = 99] = "Enum_RuntimeSpawn_Outskirts";
    Types[Types["Enum_RuntimeSpawn_Tungsten"] = 100] = "Enum_RuntimeSpawn_Tungsten";
    Types[Types["Enum_RuntimeSpawn_Granite_Downtown"] = 101] = "Enum_RuntimeSpawn_Granite_Downtown";
    Types[Types["Enum_RuntimeSpawn_Granite_Marina"] = 102] = "Enum_RuntimeSpawn_Granite_Marina";
    Types[Types["Enum_RuntimeSpawn_Granite_MilitaryRnD"] = 103] = "Enum_RuntimeSpawn_Granite_MilitaryRnD";
    Types[Types["Enum_RuntimeSpawn_Granite_MilitaryStorage"] = 104] = "Enum_RuntimeSpawn_Granite_MilitaryStorage";
    Types[Types["Enum_RuntimeSpawn_Granite_TechCenter"] = 105] = "Enum_RuntimeSpawn_Granite_TechCenter";
    Types[Types["Enum_RuntimeSpawn_Sand"] = 106] = "Enum_RuntimeSpawn_Sand";
    Types[Types["Enum_SpotStatus"] = 107] = "Enum_SpotStatus";
    Types[Types["Enum_StationaryEmplacements"] = 108] = "Enum_StationaryEmplacements";
})(Types || (exports.Types = Types = {}));
var Cameras;
(function (Cameras) {
    Cameras[Cameras["FirstPerson"] = 0] = "FirstPerson";
    Cameras[Cameras["Free"] = 1] = "Free";
    Cameras[Cameras["ThirdPerson"] = 2] = "ThirdPerson";
})(Cameras || (exports.Cameras = Cameras = {}));
function GetObjId(obj) {
    return obj.ObjId;
}
function GetObjectPosition(obj) {
    if (obj)
        return obj.position;
    console.warn('GetObjectPosition called with undefined obj');
    return zero;
}
function rotationMatrixToEuler(right, up, front) {
    const pitch = Math.asin(-front.y);
    const yaw = Math.atan2(right.y, up.y);
    const roll = Math.atan2(front.x, front.z);
    return CreateVector(pitch, yaw, roll);
}
function eulerToRotationMatrix(euler) {
    const e = euler;
    const pitch = e.x;
    const yaw = e.y;
    const roll = e.z;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    return {
        right: CreateVector(cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr),
        up: CreateVector(-cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr),
        front: CreateVector(sy * cp, -sp, cy * cp)
    };
}
function GetObjectRotation(obj) {
    if (!obj) {
        console.warn('GetObjectRotation called with undefined obj');
        return zero;
    }
    if (!obj.right || !obj.up || !obj.front) {
        return zero;
    }
    return rotationMatrixToEuler(obj.right, obj.up, obj.front);
}
const teams = [];
function GetTeam(playerOrTeamNumber) {
    if (typeof playerOrTeamNumber === 'number') {
        while (teams.length <= playerOrTeamNumber) {
            teams.push({ type: 'Team', ObjId: teams.length });
        }
        return teams[playerOrTeamNumber];
    }
    else {
        const player = playerOrTeamNumber;
        while (teams.length <= player.team) {
            teams.push({ type: 'Team', ObjId: teams.length });
        }
        return teams[player.team];
    }
}
function EndGameMode(player) {
    const team = GetTeam(player);
    exports.winningTeam = team;
}
function GetSpawner(spawnerNumber) {
    const spawner = aiSpawners[spawnerNumber];
    return spawner;
}
exports.aiSpawns = [];
exports.aiUnspawns = [];
function SpawnAIFromAISpawner(spawner) {
    exports.aiSpawns.push(spawner);
}
function UnspawnAllAIsFromAISpawner(spawner) {
    const simSpawner = spawner;
    if (simSpawner.spawnedList) {
        for (let i = 0; i < simSpawner.spawnedList.length; i++) {
            const grunt = simSpawner.spawnedList[i];
            grunt.isDead = true;
            grunt.isSpawned = false;
            exports.aiUnspawns.push(grunt);
        }
        simSpawner.spawnedList = [];
    }
}
function CreateAI() {
    if (exports.aiSpawns.length == 0)
        return undefined;
    const spawner = exports.aiSpawns[0];
    spawner.spawned = true;
    exports.aiSpawns.splice(0, 1);
    const grunt = CreatePlayer();
    allPlayers.array.push(grunt);
    grunt.isAISoldier = true;
    if (spawner.AlternateSpawns) {
        const alternateSpawns = spawner.AlternateSpawns;
        const randomIndex = Math.floor(Math.random() * alternateSpawns.length);
        const randomSpawn = alternateSpawns[randomIndex];
        const spawnPoint = spawnPoints[randomSpawn];
        grunt.position = spawnPoint.position;
    }
    else {
        grunt.position = spawner.position;
    }
    const simSpawner = spawner;
    if (!simSpawner.spawnedList)
        simSpawner.spawnedList = [];
    simSpawner.spawnedList.push(grunt);
    const onSpawnerSpawned = modscript.OnSpawnerSpawned;
    if (onSpawnerSpawned)
        onSpawnerSpawned(grunt, spawner);
    return grunt;
}
function DestroyAI() {
    if (exports.aiUnspawns.length == 0)
        return undefined;
    const grunt = exports.aiUnspawns[0];
    exports.aiUnspawns.splice(0, 1);
    return grunt;
}
let modscript;
let gameModeStarted = false;
exports.SIM_TICK_TIME = 0.1; // seconds
// mods run at 30hz but using 10hz here for simpler debugging (for now)
async function Loop(loopSeconds, waitTimeout = exports.SIM_TICK_TIME) {
    const ticks = Math.floor(loopSeconds / exports.SIM_TICK_TIME);
    const onPlayerLeaveGame = modscript.OnPlayerLeaveGame;
    const ongoingGlobal = modscript.OngoingGlobal;
    const ongoingPlayer = modscript.OngoingPlayer;
    const ongoingTeam = modscript.OngoingTeam;
    const ongoingHQ = modscript.OngoingHQ;
    const ongoingSector = modscript.OngoingSector;
    const ongoingMCOM = modscript.OngoingMCOM;
    let winDelay = 20;
    for (let t = 0; t < ticks; t++) {
        if (!gameModeTimePaused) {
            gameModeTime += exports.SIM_TICK_TIME;
        }
        let aiSoldier = CreateAI();
        if (aiSoldier) {
            mod.DeployPlayer(aiSoldier);
        }
        aiSoldier = DestroyAI();
        if (aiSoldier) {
            if (onPlayerLeaveGame)
                onPlayerLeaveGame(aiSoldier.ObjId);
            RemovePlayer(aiSoldier);
        }
        if (ongoingGlobal)
            ongoingGlobal();
        if (ongoingPlayer) {
            let allPlayers = mod.AllPlayers();
            let playerCount = mod.CountOf(allPlayers);
            for (let i = 0; i < playerCount; i++) {
                let player = mod.ValueInArray(allPlayers, i);
                ongoingPlayer(player);
            }
        }
        if (ongoingTeam) {
            for (let i = 0; i < 3; i++) {
                let team = mod.GetTeam(i);
                ongoingTeam(team);
            }
        }
        if (ongoingHQ) {
            for (const id in hqs) {
                const hq = hqs[id];
                ongoingHQ(hq);
            }
        }
        if (ongoingSector) {
            for (const id in sectors) {
                const sector = sectors[id];
                ongoingSector(sector);
            }
        }
        if (ongoingMCOM) {
            for (const id in mcoms) {
                const mcom = mcoms[id];
                ongoingMCOM(mcom);
            }
        }
        const localWinningTeam = exports.winningTeam;
        if (!localWinningTeam) {
            UpdateCapturePoints();
            UpdateMCOMs();
            UpdateWinningTeam();
        }
        if (localWinningTeam && winDelay-- == 0) {
            break;
        }
        await WaitTimeout(waitTimeout);
        resolveWaits();
    }
    // console.debug("Loop finished");
}
function UpdateWinningTeam() {
    const onGameModeEnding = modscript.OnGameModeEnding;
    if (gameModeTime >= gameModeTimeLimit) {
        exports.winningTeam = GetTeam(0);
        console.log('Game ended due to timeout');
        if (onGameModeEnding)
            onGameModeEnding();
        return;
    }
    // see if any team scored enough points to win
    for (const teamNum in gameModeScore) {
        const score = gameModeScore[teamNum];
        if (score >= gameModeTargetScore) {
            exports.winningTeam = GetTeam(parseInt(teamNum));
            console.log('Game ended due to score limit reached by team ' + exports.winningTeam);
            if (onGameModeEnding)
                onGameModeEnding();
            break;
        }
    }
}
const captureThreshold = 10;
function UpdateCapturePoints() {
    // for each capture point, check if any players are in the area
    for (const cp of Object.values(capturePoints)) {
        const playersInArea = [];
        let team1Count = 0;
        let team2Count = 0;
        for (let j = 0; j < allPlayers.array.length; j++) {
            const player = allPlayers.array[j];
            if (!player.isAlive)
                continue;
            const distSq = GetDistanceSquared(player.position, cp.position);
            if (distSq <= cp.captureRadius * cp.captureRadius) {
                playersInArea.push(player.ObjId);
                if (mod.GetObjId(mod.GetTeam(player)) == 1) {
                    team1Count++;
                }
                else if (mod.GetObjId(mod.GetTeam(player)) == 2) {
                    team2Count++;
                }
            }
        }
        // compare playersInArea to cp.currentPlayersInArea
        const enteredPlayers = playersInArea.filter((x) => !cp.currentPlayersInArea.includes(x));
        const exitedPlayers = cp.currentPlayersInArea.filter((x) => !playersInArea.includes(x));
        cp.currentPlayersInArea = playersInArea;
        // call capturing event
        if (playersInArea.length > 0) {
            const onCapturePointCapturing = modscript.OnCapturePointCapturing;
            if (onCapturePointCapturing)
                onCapturePointCapturing(cp);
        }
        // call enter events
        if (enteredPlayers.length > 0) {
            const onPlayerEnterCapturePoint = modscript.OnPlayerEnterCapturePoint;
            for (const playerId of enteredPlayers) {
                if (onPlayerEnterCapturePoint)
                    onPlayerEnterCapturePoint(allPlayers.array[playerId], cp);
            }
        }
        // call exit events
        if (exitedPlayers.length > 0) {
            const onPlayerExitCapturePoint = modscript.OnPlayerExitCapturePoint;
            for (const playerId of exitedPlayers) {
                if (onPlayerExitCapturePoint)
                    onPlayerExitCapturePoint(allPlayers.array[playerId], cp);
            }
        }
        if (team1Count === team2Count)
            continue; // No progress when balanced
        // Capture point progress: positive = Team 1, negative = Team 2, 0 = neutral
        const captureRate = 0.1;
        const neutralTeam = GetTeam(0);
        const team1 = GetTeam(1);
        const team2 = GetTeam(2);
        // Update progress based on player advantage
        const previousProgress = cp.captureProgress;
        const playerDifference = team1Count - team2Count;
        cp.captureProgress += playerDifference * captureRate;
        // Check for neutralization (progress crossed zero)
        if ((previousProgress > 0 && cp.captureProgress <= 0) ||
            (previousProgress < 0 && cp.captureProgress >= 0)) {
            cp.captureProgress = 0;
            if (!Equals(cp.currentOwnerTeam, neutralTeam)) {
                cp.previousOwnerTeam = cp.currentOwnerTeam;
                cp.currentOwnerTeam = neutralTeam;
                const onCapturePointLost = modscript.OnCapturePointLost;
                if (onCapturePointLost)
                    onCapturePointLost(cp);
            }
        }
        // Check for Team 1 capture
        else if (cp.captureProgress >= captureThreshold) {
            cp.captureProgress = captureThreshold;
            if (!Equals(cp.currentOwnerTeam, team1)) {
                cp.previousOwnerTeam = cp.currentOwnerTeam;
                cp.currentOwnerTeam = team1;
                const onCapturePointCaptured = modscript.OnCapturePointCaptured;
                if (onCapturePointCaptured)
                    onCapturePointCaptured(cp);
            }
        }
        // Check for Team 2 capture
        else if (cp.captureProgress <= -captureThreshold) {
            cp.captureProgress = -captureThreshold;
            if (!Equals(cp.currentOwnerTeam, team2)) {
                cp.previousOwnerTeam = cp.currentOwnerTeam;
                cp.currentOwnerTeam = team2;
                const onCapturePointCaptured = modscript.OnCapturePointCaptured;
                if (onCapturePointCaptured)
                    onCapturePointCaptured(cp);
            }
        }
    }
}
function UpdateMCOMs() {
    for (const mcom of Object.values(mcoms)) {
        for (let j = 0; j < allPlayers.array.length; j++) {
            // if mcom is enabled decrement fuse timer
            if (mcom.Enabled && mcom.fuseTimer > 0) {
                mcom.fuseTimer -= exports.SIM_TICK_TIME;
                if (mcom.fuseTimer <= 0) {
                    mcom.fuseTimer = 0;
                    // explode mcom
                    const onMCOMExploded = modscript.OnMCOMExploded;
                    if (onMCOMExploded)
                        onMCOMExploded(mcom);
                }
            }
        }
    }
}
// test only
function ArmMCOM(mcom) {
    mcom.fuseTimer = mcom.FuseTime;
    const onMCOMArmed = modscript.OnMCOMExploded;
    if (onMCOMArmed)
        onMCOMArmed(mcom);
}
function GetDistanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}
function GetPlayersOnPoint(capturePoint) {
    const cp = capturePoints[capturePoint.ObjId];
    const players = EmptyArray();
    for (const playerId of cp.currentPlayersInArea) {
        const player = allPlayers.array[playerId];
        if (player) {
            players.array.push(player);
        }
    }
    return players;
}
function Reset() {
    allPlayers.array = [];
    createdPlayers = [];
    exports.winningTeam = null;
    gameModeTime = initialGameModeTime;
    gameModeStarted = false;
    exports.aiSpawns = [];
    mcoms = {};
    volumes = {};
    exports.matchTimeElapsed = 0;
    // Clear UI tree
    if (exports.uiRoot && exports.uiRoot.children) {
        exports.uiRoot.children = [];
    }
}
function Message(format, ...args) {
    if (exports.winningTeam)
        console.log('Calling Message after winning team has been set');
    let text = format;
    for (let i = 0; i < args.length; i++) {
        if (typeof args[i] === 'string') {
            text = text.replace(/{}/, args[i]);
        }
        else if (typeof args[i] === 'number') {
            text = text.replace(/{}/, args[i].toString());
        }
    }
    // console.log(format);
    const m = {
        type: 'Message',
        format: format,
        text: text,
    };
    return m;
}
function DisplayNotificationMessage(message, target) {
    let targetInfo = 'all players';
    if (target) {
        if (target.type === 'Team') {
            targetInfo = `Team ${GetObjId(target)}`;
        }
        else {
            targetInfo = `Player ${GetObjId(target)}`;
        }
    }
    console.log(`DisplayNotificationMessage: "${message.text}" -> ${targetInfo}`);
}
function SendErrorReport(message) {
    console.warn(`[ErrorReport] ${message.text || message.format}`);
}
function GetUIRoot() {
    return exports.uiRoot;
}
function CreateVector(x, y, z) {
    return {
        type: 'Vector',
        x,
        y,
        z,
    };
}
function CreateTransform(position, rotation) {
    return {
        type: 'Transform',
        position,
        rotation,
    };
}
function SetObjectTransform(object, transform) {
    const obj = object;
    obj.position = transform.position;
    if (transform.rotation) {
        const matrix = eulerToRotationMatrix(transform.rotation);
        obj.right = matrix.right;
        obj.up = matrix.up;
        obj.front = matrix.front;
    }
}
const STRING_TYPE = 'string';
const NUMBER_TYPE = 'number';
const VECTOR_TYPE = 'Vector';
const UIWIDGET_TYPE = 'UIWidget';
const UIANCHOR_TYPE = 'number';
const MESSAGE_TYPE = 'Message';
const PLAYER_TYPE = 'Player';
const TEAM_TYPE = 'Team';
const BOOLEAN_TYPE = 'boolean';
const UIBGFILL_TYPE = 'number';
const UIDEPTH_TYPE = 'number';
const AddUIText5ArgTypes = [STRING_TYPE, VECTOR_TYPE, VECTOR_TYPE, UIANCHOR_TYPE, MESSAGE_TYPE];
const AddUIText6ArgTypes = [
    STRING_TYPE,
    VECTOR_TYPE,
    VECTOR_TYPE,
    UIANCHOR_TYPE,
    MESSAGE_TYPE,
    [PLAYER_TYPE, TEAM_TYPE],
];
const AddUIText15ArgTypes = [
    STRING_TYPE,
    VECTOR_TYPE,
    VECTOR_TYPE,
    UIANCHOR_TYPE,
    UIWIDGET_TYPE,
    BOOLEAN_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIBGFILL_TYPE,
    MESSAGE_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIANCHOR_TYPE,
];
const AddUIText16ArgTypes = [
    STRING_TYPE,
    VECTOR_TYPE,
    VECTOR_TYPE,
    UIANCHOR_TYPE,
    UIWIDGET_TYPE,
    BOOLEAN_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIBGFILL_TYPE,
    MESSAGE_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIANCHOR_TYPE,
    [PLAYER_TYPE, TEAM_TYPE],
];
const AddUIText17ArgTypes = [
    STRING_TYPE,
    VECTOR_TYPE,
    VECTOR_TYPE,
    UIANCHOR_TYPE,
    UIWIDGET_TYPE,
    BOOLEAN_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIBGFILL_TYPE,
    MESSAGE_TYPE,
    NUMBER_TYPE,
    VECTOR_TYPE,
    NUMBER_TYPE,
    UIANCHOR_TYPE,
    UIDEPTH_TYPE,
    [PLAYER_TYPE, TEAM_TYPE],
];
const parentTypes = {
    UIContainer: [UIWIDGET_TYPE],
};
function argsMatch(args, types) {
    if (args.length !== types.length) {
        return false;
    }
    for (let i = 0; i < args.length; i++) {
        const type = types[i];
        const arg = args[i];
        let argType = typeof arg;
        if (argType === 'object') {
            const objectType = arg['type'];
            if (objectType) {
                argType = objectType;
            }
        }
        if (Array.isArray(type)) {
            if (!type.includes(argType)) {
                return false;
            }
        }
        else if (argType !== type) {
            const parentTypeList = parentTypes[argType];
            if (!parentTypeList || !parentTypeList.includes(type))
                return false;
        }
    }
    return true;
}
function AddUIText(name, position, size, anchor, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14, ...rest) {
    if (argsMatch(arguments, AddUIText5ArgTypes)) {
        AddUIText5(name, position, size, anchor, arg4);
        return;
    }
    if (argsMatch(arguments, AddUIText6ArgTypes)) {
        AddUIText6(name, position, size, anchor, arg4, arg5);
        return;
    }
    let parent = arg4;
    if (!parent) {
        parent = exports.uiRoot;
    }
    if (argsMatch(arguments, AddUIText15ArgTypes)) {
        AddUIText15(name, position, size, anchor, parent, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14);
    }
    else if (argsMatch(arguments, AddUIText16ArgTypes)) {
        let restrict = rest[0];
        AddUIText16(name, position, size, anchor, parent, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14, restrict);
    }
    else if (argsMatch(arguments, AddUIText17ArgTypes)) {
        AddUIText17(name, position, size, anchor, parent, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14, rest[0], rest[1]);
    }
    else {
        try {
            console.error(`AddUIText: Invalid arguments: ${JSON.stringify(arguments)}`);
        }
        catch (e) {
            console.error(`AddUIText: Invalid arguments: ${arguments}`);
            argsMatch(arguments, AddUIText5ArgTypes);
            argsMatch(arguments, AddUIText6ArgTypes);
            argsMatch(arguments, AddUIText15ArgTypes);
            argsMatch(arguments, AddUIText16ArgTypes);
            argsMatch(arguments, AddUIText17ArgTypes);
        }
    }
}
function AddUIText5(name, position, size, anchor, message) {
    console.log('AddUIText5');
    exports.uiRoot.children.push({
        type: 'UIWidget',
        uiType: 'Text',
        visible: true,
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: exports.uiRoot,
        children: [],
    });
}
function AddUIText6(name, position, size, anchor, message, receiver) {
    console.log('AddUIText6');
    exports.uiRoot.children.push({
        type: 'UIWidget',
        uiType: 'Text',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: exports.uiRoot,
        visible: true,
        textLabel: message.text,
        children: [],
        restrict: receiver,
    });
}
function AddUIText15(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill, message, textSize, textColor, textAlpha, textAnchor) {
    console.log('AddUIText15');
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Text',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        padding: padding,
        bgColor: bgColor,
        bgAlpha: bgAlpha,
        textSize: textSize,
        textColor: textColor,
        textAlpha: textAlpha,
        textAnchor: textAnchor,
        bgFill: bgFill,
        textLabel: message.text,
        children: [],
    });
}
function AddUIText16(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill, message, textSize, textColor, textAlpha, textAnchor, receiver) {
    console.log('AddUIText16');
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Text',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        padding: padding,
        bgColor: bgColor,
        bgAlpha: bgAlpha,
        textSize: textSize,
        textColor: textColor,
        textAlpha: textAlpha,
        textAnchor: textAnchor,
        bgFill: bgFill,
        textLabel: message.text,
        restrict: receiver,
        children: [],
    });
}
// Creates a new UI Text Widget.
function AddUIText17(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill, message, textSize, textColor, textAlpha, textAnchor, depth, receiver) {
    console.log('AddUIText17');
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Text',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        textSize: textSize,
        bgFill: bgFill,
        textLabel: message.text,
        depth: depth,
        restrict: receiver,
        children: [],
    });
}
function AddUIContainer(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9, ...rest) {
    if (!parent) {
        parent = exports.uiRoot;
    }
    // use defined arguments to decide which version of AddUIContainer to call
    if (arguments.length === 4) {
        AddUIContainer4(arg0, arg1, arg2, arg3);
    }
    else if (arguments.length === 5) {
        AddUIContainer5(arg0, arg1, arg2, arg3, arguments[4]);
    }
    else if (arguments.length === 10) {
        AddUIContainer10(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9);
    }
    else if (arguments.length === 11) {
        AddUIContainer11(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9, rest[0]);
    }
    else if (arguments.length === 12) {
        AddUIContainer12(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9, rest[0], rest[1]);
    }
    else {
        console.error(`AddUIContainer: Invalid arguments: ${JSON.stringify(arguments)}`);
    }
}
function AddUIContainer4(name, position, size, anchor) {
    const parent = exports.uiRoot;
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Container',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: true,
        children: [],
    });
}
function AddUIContainer5(name, position, size, anchor, receiver) {
    const parent = exports.uiRoot;
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Container',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: true,
        restrict: receiver,
        children: [],
    });
}
function AddUIContainer10(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill) {
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Container',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        padding: padding,
        bgColor: bgColor,
        bgAlpha: bgAlpha,
        bgFill: bgFill,
        children: [],
    });
}
function AddUIContainer11(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill, receiverOrDepth) {
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Container',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        padding: padding,
        bgColor: bgColor,
        bgAlpha: bgAlpha,
        bgFill: bgFill,
        restrict: receiverOrDepth,
        depth: receiverOrDepth,
        children: [],
    });
}
function AddUIContainer12(name, position, size, anchor, parent, visible, padding, bgColor, bgAlpha, bgFill, depth, receiver) {
    parent.children.push({
        type: 'UIWidget',
        uiType: 'Container',
        name: name,
        position: position,
        size: size,
        anchor: anchor,
        parent: parent,
        visible: visible,
        padding: padding,
        bgColor: bgColor,
        bgAlpha: bgAlpha,
        bgFill: bgFill,
        depth: depth,
        restrict: receiver,
        children: [],
    });
}
function AddUIButton(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14, arg15, arg16, arg17, arg18, arg19, arg20, arg21, arg22) {
    if (!parent) {
        parent = exports.uiRoot;
    }
    let properties = {
        type: 'UIWidget',
        uiType: 'Button',
        name: arg0,
        position: arg1,
        size: arg2,
        anchor: arg3,
        parent: parent,
        visible: arg5,
        padding: arg6,
        bgColor: arg7,
        bgAlpha: arg8,
        bgFill: arg9,
        buttonEnabled: arg10,
        buttonColorBase: arg11,
        buttonAlphaBase: arg12,
        buttonColorDisabled: arg13,
        buttonAlphaDisabled: arg14,
        buttonColorPressed: arg15,
        buttonAlphaPressed: arg16,
        buttonColorHover: arg17,
        buttonAlphaHover: arg18,
        buttonColorFocused: arg19,
        buttonColorFocusedAlpha: arg20,
        children: [],
    };
    if (arg21) {
        console.log('AddUIButton fixme');
    }
    parent.children.push(properties);
}
function AddUIImage(arg0, arg1, arg2, arg3, parent, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14) {
    if (!parent) {
        parent = exports.uiRoot;
    }
    let properties = {
        type: 'UIWidget',
        uiType: 'Image',
        name: arg0,
        position: arg1,
        size: arg2,
        anchor: arg3,
        parent: parent,
        visible: arg5,
        padding: arg6,
        bgColor: arg7,
        bgAlpha: arg8,
        bgFill: arg9,
        imageType: arg10,
        imageColor: arg11,
        imageAlpha: arg12,
    };
    if (arg14) {
        properties['restrict'] = arg14;
    }
    parent.children.push(properties);
}
function SetUIWidgetDepth(widget, depth) {
    if (!widget) {
        console.warn('SetUIWidgetDepth widget is not defined');
        return;
    }
    widget.depth = depth;
}
function GetUIWidgetName(widget) {
    return widget.name;
}
function SetUIWidgetPosition(widget, position) {
    if (!widget) {
        console.warn('SetUIWidgetPosition widget is not defined');
        return;
    }
    widget.position = position;
}
function SetUIButtonEnabled(widget, enabled) {
    const w = widget;
    w.buttonEnabled = enabled;
}
function DeleteAllUIWidgets() {
    let root = exports.uiRoot;
    root.children = [];
}
let unInputEnabled = false;
function EnableUIInputMode(enable) {
    unInputEnabled = enable;
}
function deleteWidgetAndChildren(widget) {
    if (!widget.children || widget.children.length === 0) {
        return false;
    }
    for (let child of widget.children) {
        deleteWidgetAndChildren(child);
        DeleteUIWidget(child);
    }
    widget.children = [];
    console.log(`Deleted all children of UIWidget: ${widget.name}`);
    return true;
}
function deleteUIWidgetRecursive(parent, widget) {
    if (!parent.children) {
        return false;
    }
    for (let child of parent.children) {
        if (child === widget) {
            deleteWidgetAndChildren(widget);
            const index = parent.children.indexOf(child);
            if (index > -1) {
                parent.children.splice(index, 1);
                console.log(`Deleted UIWidget: ${widget.name}`);
            }
            return true;
        }
        let found = deleteUIWidgetRecursive(child, widget);
        if (found)
            return true;
    }
    return false;
}
function DeleteUIWidget(widget) {
    if (!widget) {
        console.warn(`DeleteUIWidget: widget is undefined or null`);
        return;
    }
    if (!deleteUIWidgetRecursive(exports.uiRoot, widget)) {
        if (widget.name)
            console.error(`Failed to delete UIWidget: ${widget.name}`);
        else {
            console.error(`Failed to delete UIWidget: (unnamed)`);
        }
    }
}
function FindUIWidgetWithNameRecursive(node, name) {
    if (!node.children) {
        return null;
    }
    for (let child of node.children) {
        if (child.name === name) {
            return child;
        }
        let grandchild = FindUIWidgetWithNameRecursive(child, name);
        if (grandchild) {
            return grandchild;
        }
    }
    return null;
}
function FindUIWidgetWithName(name) {
    const w = FindUIWidgetWithNameRecursive(exports.uiRoot, name);
    if (!w)
        console.warn(`FindUIWidgetWithNameRecursive: Widget with name "${name}" not found`);
    return w;
}
function SetUIWidgetName(widget, name) {
    if (!widget) {
        console.warn('SetUIWidgetName widget is not defined');
        return;
    }
    widget.name = name;
}
function SetUIWidgetVisible(widget, visible) {
    if (!widget) {
        console.warn('SetUIWidgetVisible widget is not defined');
        return;
    }
    widget.visible = visible;
}
function SetUIWidgetSize(widget, size) {
    if (!widget) {
        console.warn('SetUIWidgetSize widget is not defined');
        return;
    }
    widget.size = size;
}
function SetUITextLabel(widget, label) {
    if (!widget) {
        console.warn('SetUITextLabel widget is not defined');
        return;
    }
    widget.textLabel = label.text;
}
function SetUITextColor(widget, color) {
    if (!widget) {
        console.warn('SetUITextColor widget is not defined');
        return;
    }
    widget.textColor = color;
}
function SetUITextAlpha(widget, alpha) {
    if (!widget) {
        console.warn('SetUITextAlpha widget is not defined');
        return;
    }
    widget.textAlpha = alpha;
}
function DumpUITree(player = null, widget = null, indent = '') {
    if (!widget) {
        widget = exports.uiRoot;
        if (player) {
            console.log(`=============== UI Widget Tree (Player ${player.ObjId}) ===============`);
        }
        else {
            console.log('=============== UI Widget Tree ===============');
        }
    }
    // Check if this widget should be visible to the specified player
    if (widget.restrict && player) {
        const restrictType = widget.restrict.type;
        const restrictId = widget.restrict.ObjId;
        const playerId = player.ObjId;
        // If restricted to a player and it's not this player, skip it
        if (restrictType === 'Player' && restrictId !== playerId) {
            return;
        }
        // If restricted to a team, check if player is on that team
        if (restrictType === 'Team') {
            // For now, skip team checking - we'd need player.team
            // Could add this logic later if needed
        }
    }
    const name = widget.name || '(unnamed)';
    const type = widget.uiType || 'Unknown';
    const visible = widget.visible ? 'visible' : 'HIDDEN';
    // Build detailed info string
    let details = [];
    // Position and size
    if (widget.position) {
        details.push(`pos:[${widget.position.x},${widget.position.y}]`);
    }
    if (widget.size) {
        details.push(`size:[${widget.size.x},${widget.size.y}]`);
    }
    // Anchor
    if (widget.anchor !== undefined) {
        const anchorNames = [
            'TopLeft',
            'TopCenter',
            'TopRight',
            'CenterLeft',
            'Center',
            'CenterRight',
            'BottomLeft',
            'BottomCenter',
            'BottomRight',
        ];
        details.push(`anchor:${anchorNames[widget.anchor] || widget.anchor}`);
    }
    // Text content
    if (widget.textLabel !== undefined) {
        details.push(`text:"${widget.textLabel}"`);
    }
    if (widget.textSize !== undefined) {
        details.push(`textSize:${widget.textSize}`);
    }
    // Colors
    if (widget.bgColor) {
        details.push(`bgColor:[${widget.bgColor.x.toFixed(2)},${widget.bgColor.y.toFixed(2)},${widget.bgColor.z.toFixed(2)}]`);
    }
    if (widget.bgAlpha !== undefined && widget.bgAlpha !== 1) {
        details.push(`bgAlpha:${widget.bgAlpha}`);
    }
    if (widget.textColor) {
        details.push(`textColor:[${widget.textColor.x.toFixed(2)},${widget.textColor.y.toFixed(2)},${widget.textColor.z.toFixed(2)}]`);
    }
    // Background fill
    if (widget.bgFill !== undefined) {
        const fillNames = ['None', 'Solid', 'Outline', 'OutlineThick', 'Blur'];
        details.push(`bgFill:${fillNames[widget.bgFill] || widget.bgFill}`);
    }
    // Depth
    if (widget.depth !== undefined) {
        const depthNames = ['BelowGameUI', 'GameUI', 'AboveGameUI'];
        details.push(`depth:${depthNames[widget.depth] || widget.depth}`);
    }
    // Padding
    if (widget.padding !== undefined && widget.padding !== 0) {
        details.push(`padding:${widget.padding}`);
    }
    // Child count (filtered)
    let visibleChildCount = 0;
    if (widget.children) {
        for (let child of widget.children) {
            // Check if child would be visible to the specified player
            if (child.restrict && player) {
                const restrictType = child.restrict.type;
                const restrictId = child.restrict.ObjId;
                const playerId = player.ObjId;
                if (restrictType === 'Player' && restrictId !== playerId) {
                    continue; // Skip this child
                }
            }
            visibleChildCount++;
        }
    }
    if (visibleChildCount > 0) {
        details.push(`children:${visibleChildCount}`);
    }
    // Build the output line
    const detailsStr = details.length > 0 ? ` | ${details.join(', ')}` : '';
    console.log(`${indent}[${type}] "${name}" (${visible})${detailsStr}`);
    // Recursively dump children
    if (widget.children) {
        for (let child of widget.children) {
            DumpUITree(player, child, indent + '  ');
        }
    }
    if (!indent) {
        console.log('==============================================');
    }
}
function SetGameModeTimeLimit(limit) {
    gameModeTimeLimit = limit;
}
function GetGameModeTimeLimit() {
    return gameModeTimeLimit;
}
function PauseGameModeTime(paused) {
    gameModeTimePaused = paused;
}
function GetRoundTime() {
    return gameModeTime;
}
function GetGameModeScore(teamOrPlayer) {
    let team;
    if (teamOrPlayer.type === 'Team') {
        team = teamOrPlayer;
    }
    else {
        const player = teamOrPlayer;
        team = GetTeam(player);
    }
    const teamNum = GetObjId(team);
    return gameModeScore[teamNum] || 0;
}
function SetScoreboardType(type) {
    scoreboardType = type;
}
function SetSpawnMode(spawnMode) {
    console.warn('SetSpawnMode not fully implemented');
}
function SetScoreboardHeader(header) {
    if (header.type !== 'Message') {
        console.error(`SetScoreboardHeader: header is not a Message`);
        return;
    }
    console.warn(`SetScoreboardHeader not simulated`);
}
function SetScoreboardColumnNames(...columnNames) {
    for (let i = 0; i < columnNames.length; i++) {
        if (columnNames[i].type !== 'Message') {
            console.error(`SetScoreboardColumnNames: columnNames[${i}] is not a Message`);
            return;
        }
    }
    console.warn(`SetScoreboardColumnNames not simulated`);
}
function SetScoreboardColumnWidths(...columnWidths) {
    console.warn(`SetScoreboardColumnWidths not simulated`);
}
function SetScoreboardSorting(columnNum, ascending) {
    console.warn(`SetScoreboardSorting not simulated`);
}
function SetScoreboardPlayerValues(player, column1Value, column2Value, column3Value, column4Value, column5Value) {
    console.warn(`SetScoreboardPlayerValues not simulated`);
}
function SkipManDown(player) {
    console.warn(`modsim SkipManDown not implemented yet`);
}
// todo: remove this
function EnableDefaultGameModeWinCondition(enable) { }
function GetMCOM(mcomId) {
    const mcom = mcoms[mcomId];
    if (!mcom)
        console.warn(`GetMCOM: mcoms[${mcomId}] is undefined`);
    return mcom;
}
function GetSpatialObject(spatialObjectId) {
    const obj = modSimObjects[spatialObjectId];
    if (!obj)
        console.warn(`GetSpatialObject: modSimObjects[${spatialObjectId}] is undefined`);
    return obj;
}
function EnableGameModeObjective(objective, enable) {
    if (!objective) {
        console.warn(`EnableGameModeObjective: objective is undefined`);
        return;
    }
    switch (objective.type) {
        case 'Sector':
            const sector = objective;
            sector.SectorEnabled = enable;
            break;
        case 'MCOM':
            const mcom = objective;
            mcom.Enabled = enable;
            break;
        default:
            console.warn('EnableGameModeObjective: objective type not supported');
            break;
    }
}
function SetMCOMFuseTime(mcom, fuseTime) {
    if (!mcom) {
        console.warn(`SetMCOMFuseTime: mcom is undefined`);
        return;
    }
    mcom.FuseTime = fuseTime;
}
function GetCapturePoint(id) {
    const cp = capturePoints[id];
    if (!cp)
        console.warn(`GetCapturePoint: capturePoints[${id}] is undefined`);
    return cp;
}
function GetCurrentOwnerTeam(capturePoint) {
    return capturePoint.currentOwnerTeam;
}
function GetPreviousOwnerTeam(capturePoint) {
    return capturePoint.previousOwnerTeam;
}
function SetCapturePointCapturingTime(capturePoint, capturingTime) {
    capturePoint.capturingTime = capturingTime;
}
function SetCapturePointNeutralizationTime(capturePoint, neutralizationTime) {
    capturePoint.neutralizationTime = neutralizationTime;
}
function SetCapturePointOwner(capturePoint, team) {
    capturePoint.currentOwnerTeam = team;
}
function SetMaxCaptureMultiplier(capturePoint, multiplier) {
    capturePoint.maxCaptureMultiplier = multiplier;
}
function GetCaptureProgress(capturePoint) {
    return Math.abs(capturePoint.captureProgress) / captureThreshold;
}
function GetOwnerProgressTeam(capturePoint) {
    if (capturePoint.captureProgress > 0) {
        return GetTeam(1);
    }
    else if (capturePoint.captureProgress < 0) {
        return GetTeam(2);
    }
    else {
        return capturePoint.currentOwnerTeam;
    }
}
function GetHQ(id) {
    const hq = hqs[id];
    if (!hq)
        console.warn(`GetHQ: hqs[${id}] is undefined`);
    return hq;
}
function EnableHQ(hq, enable) {
    if (!hq) {
        console.warn(`EnableHQ: hq is undefined`);
        return;
    }
    hq.HQEnabled = enable;
}
function GetSector(number) {
    const sector = sectors[number];
    if (!sector)
        console.warn(`GetSector: sectors[${number}] is undefined`);
    return sector;
}
function AISetUnspawnOnDead() {
    console.warn(`AISetUnspawnOnDead not implemented`);
}
function AIDefendPositionBehavior(player, defendPosition, minDistance, maxDistance) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const offsetX = Math.cos(angle) * distance;
    const offsetZ = Math.sin(angle) * distance;
    const newPosition = {
        type: 'Vector',
        x: defendPosition.x + offsetX,
        y: defendPosition.y,
        z: defendPosition.z + offsetZ,
    };
    console.log('AIDefendPositionBehavior: moving AI to position ', newPosition);
    player.position = newPosition;
}
function AIMoveToBehavior(player, position) {
    console.log('AIMoveToBehavior: moving AI to position ', position);
    player.position = position;
}
function AISetMoveSpeed(player, moveSpeed) {
    player.aiMoveSpeed = moveSpeed;
}
function AISetStance(player, stance) {
    player.aiStance = stance;
}
function WaitTimeout(timeMs) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeMs);
    });
}
const waitCallbacks = [];
function resolveWaits() {
    for (let i = waitCallbacks.length - 1; i >= 0; i--) {
        const callback = waitCallbacks[i];
        if (callback.endTick <= gameModeTime) {
            callback.resolve();
            waitCallbacks.splice(i, 1); // Remove the resolved callback
        }
    }
}
function Wait(delay) {
    return new Promise((resolve) => {
        waitCallbacks.push({
            endTick: gameModeTime + delay,
            resolve: resolve,
        });
    });
}
function GetSoldierState(player, state) {
    let p = player;
    if (state in SoldierStateBool) {
        switch (state) {
            case SoldierStateBool.IsAlive:
                return p.isAlive;
            case SoldierStateBool.IsAISoldier:
                return p.isAISoldier;
            case SoldierStateBool.IsInteracting:
                return p.isInteracting;
            case SoldierStateBool.IsInVehicle:
                return p.vehicle !== null;
            default:
                throw new Error(`State ${state} not implemented`);
        }
    }
    else if (state in SoldierStateVector) {
        switch (state) {
            case SoldierStateVector.GetLinearVelocity:
                return p.linearVelocity;
            case SoldierStateVector.GetPosition:
                return p.position;
            case SoldierStateVector.GetFacingDirection:
                return p.facingDirection;
            case SoldierStateVector.EyePosition:
                return p.eyePosition;
            default:
                throw new Error(`State ${state} not implemented`);
        }
    }
    else if (state in SoldierStateNumber) {
        switch (state) {
            case SoldierStateNumber.CurrentHealth:
                return p.currentHealth;
            case SoldierStateNumber.Speed:
                return p.speed;
            case SoldierStateNumber.MaxHealth:
                return p.maxHealth;
            case SoldierStateNumber.NormalizedHealth:
                return p.normalizedHealth;
            case SoldierStateNumber.CurrentWeaponAmmo:
                return p.currentWeaponAmmo;
            case SoldierStateNumber.CurrentWeaponMagazineAmmo:
                return p.currentWeaponMagazineAmmo;
            default:
                throw new Error(`State ${state} not implemented`);
        }
    }
    return false;
}
function SetTeam(player, team) {
    player.team = team.ObjId;
}
function EnableAllPlayerDeploy(enable) {
    for (const player of allPlayers.array) {
        player.deployEnabled = enable;
    }
}
function DeployPlayer(player) {
    if (!player.deployEnabled) {
        // This function can force deployment even if deployEnabled is false, but for now we'll just log a warning
        console.warn(`DeployPlayer: Deployment is disabled for player ${player.name}`);
    }
    player.isAlive = true;
    const playerTeamNum = player.team;
    player.soldier = {
        type: 'Soldier',
        weaponsSlots: {},
    };
    if (player.soldierClass === undefined) {
        player.soldierClass = SoldierClass.Assault;
    }
    let teamHq;
    for (const hq in hqs) {
        const hqObj = hqs[hq];
        if (hqObj.team === playerTeamNum) {
            teamHq = hqObj;
            break;
        }
    }
    if (teamHq) {
        if (teamHq.InfantrySpawns.length > 0) {
            const randomSpawnPointIndex = Math.floor(Math.random() * teamHq.InfantrySpawns.length);
            const spawnPointId = teamHq.InfantrySpawns[randomSpawnPointIndex];
            const spawnPoint = spawnPoints[spawnPointId];
            player.position = spawnPoint.position;
        }
        else {
            player.position = teamHq.position;
        }
    }
    else {
        console.warn(`DeployPlayer: No HQ found for team ${playerTeamNum}, deploying at origin`);
        player.position = CreateVector(0, 0, 0);
    }
    if (modscript.OnPlayerDeployed) {
        modscript.OnPlayerDeployed(player);
    }
    else {
        console.info('OnPlayerDeployed not defined by script');
    }
}
function EnablePlayerDeploy(player, enable) {
    player.deployEnabled = enable;
}
function UndeployPlayer(player) {
    player.isAlive = false;
    player.position = undefined;
    if (modscript.OnPlayerUndeploy) {
        modscript.OnPlayerUndeploy(player);
    }
    else {
        console.info('OnPlayerUndeploy not defined by script');
    }
}
function IsSoldierClass(player, soldierClass) {
    return player.soldierClass === soldierClass;
}
function ForceRevive(player) {
    let playerObj = player;
    playerObj.isAlive = true;
}
function Kill(player) {
    player.isAlive = false;
    player.currentHealth = 0;
    player.position = undefined;
    // TODO:
    // What should killer be? For now, just set to the same as victim
    // How are deathType and weaponUnlock determined? How do we create these objects?
    // Trigger OnPlayerDied event if defined
    if (modscript.OnPlayerDied) {
        // killer is same as victim for now (suicide/environmental death)
        modscript.OnPlayerDied(player, player, undefined, undefined);
    }
}
function SetPlayerMaxHealth(player, maxHealth) {
    let playerObj = player;
    playerObj.maxHealth = maxHealth;
}
function SetAIToHumanDamageModifier(modifier) {
    console.log(`SetAIToHumanDamageModifier called with modifier: ${modifier}`);
}
function SpotTarget(targetPlayer, durationOrSpotterOrSpotStatus, durationOrSpotStatus, spotStatus) {
    let duration;
    let spotter;
    let status;
    if (typeof durationOrSpotterOrSpotStatus === 'number') {
        duration = durationOrSpotterOrSpotStatus;
        status = durationOrSpotStatus;
    }
    else if (durationOrSpotterOrSpotStatus &&
        typeof durationOrSpotterOrSpotStatus === 'object' &&
        'ObjId' in durationOrSpotterOrSpotStatus) {
        spotter = durationOrSpotterOrSpotStatus;
        duration = durationOrSpotStatus;
        status = spotStatus;
    }
    else {
        status = durationOrSpotterOrSpotStatus;
    }
    const targetId = targetPlayer.ObjId;
    const spotterId = spotter ? spotter.ObjId : 'all';
    const durationStr = duration !== undefined ? `${duration}s` : 'indefinite';
    const statusStr = status !== undefined ? `status=${status}` : '';
    console.log(`SpotTarget: Player ${targetId} spotted by ${spotterId} for ${durationStr} ${statusStr}`);
}
function SetUITextSize(widget, size) {
    const w = widget;
    w.textSize = size;
}
function SetUITextAnchor(widget, anchor) {
    const w = widget;
    w.textAnchor = anchor;
}
function SetUIWidgetBgColor(w, color) {
    if (!w) {
        console.warn('SetUIWidgetBgColor widget is not defined');
        return;
    }
    w.bgColor = color;
}
function SetUIWidgetBgFill(w, fill) {
    if (!w) {
        console.warn('SetUIWidgetBgFill widget is not defined');
        return;
    }
    w.bgFill = fill;
}
function SetUIWidgetBgAlpha(w, alpha) {
    if (!w) {
        console.warn('SetUIWidgetBgAlpha widget is not defined');
        return;
    }
    w.bgAlpha = alpha;
}
exports.matchTimeElapsed = 0;
function GetMatchTimeElapsed() {
    return Math.max(0, gameModeTime);
}
function GetMatchTimeRemaining() {
    return gameModeTimeLimit - Math.max(0, gameModeTime);
}
let createdPlayers = [];
function CreatePlayer() {
    if (createdPlayers.length == 0) {
        for (let i = 0; i < 64; i++) {
            createdPlayers.push(i);
        }
        createdPlayers.reverse();
    }
    let id = createdPlayers.pop();
    let team = (id % 2) + 1;
    let p = {
        type: 'Player',
        ObjId: id,
        name: `Player${id}`,
        id: '',
        team: team,
        isAlive: false,
        isAISoldier: false,
        isInteracting: false,
        linearVelocity: CreateVector(0, 0, 0),
        position: undefined,
        facingDirection: CreateVector(0, 0, 0),
        eyePosition: CreateVector(0, 0, 0),
        currentHealth: 100,
        maxHealth: 100,
        normalizedHealth: 1,
        currentWeaponAmmo: 30,
        currentWeaponMagazineAmmo: 30,
        inventory: [],
        soldier: undefined,
        vehicle: undefined,
        speed: 0,
        armorType: ArmorTypes.NoArmor,
        deployEnabled: true,
    };
    return p;
}
function EmptyArray() {
    return new ModArray();
}
function CountOf(allPlayers) {
    return allPlayers.array.length;
}
function ValueInArray(array, i) {
    return array.array[i];
}
function AppendToArray(array, value) {
    const newArray = new ModArray();
    newArray.array = array.array.slice();
    newArray.array.push(value);
    return newArray;
}
function AddPlayerObsolete(player) {
    allPlayers.array.push(player);
}
function RemovePlayer(player) {
    const index = allPlayers.array.indexOf(player);
    if (index > -1) {
        allPlayers.array.splice(index, 1);
    }
}
function KillPlayer(player, otherPlayer, deathType, weaponUnlock) {
    let playerObj = player;
    playerObj.isAlive = false;
    const onPlayerDied = modscript.OnPlayerDied;
    const onPlayerUndeploy = modscript.OnPlayerUndeploy;
    const onPlayerEarnedKill = modscript.OnPlayerEarnedKill;
    if (onPlayerDied)
        onPlayerDied(player, otherPlayer, deathType, weaponUnlock);
    if (otherPlayer && onPlayerEarnedKill)
        onPlayerEarnedKill(otherPlayer, player, deathType, weaponUnlock);
    if (onPlayerUndeploy)
        onPlayerUndeploy(player);
}
function AllPlayers() {
    return allPlayers;
}
function AllCapturePoints() {
    return allCapturePoints;
}
function AllVehicles() {
    return allVehicles;
}
function IsVehicleOccupied(vehicle) {
    return false;
}
function Teleport(player, position, facing) {
    if (!player.isAlive) {
        console.warn(`Teleport: player ${player.ObjId} is not alive, cannot teleport`);
        return;
    }
    player.position = position;
}
function YComponentOf(v) {
    return v.y;
}
function XComponentOf(v) {
    return v.x;
}
function ZComponentOf(v) {
    return v.z;
}
let objIdSeqNum = 0;
const modSimObjects = {};
function SpawnObject(prefabAll, position, rotation, scale) {
    const prefab = prefabAll;
    const objId = objIdSeqNum++;
    let obj = {
        type: 'Prefab',
        position: position,
        rotation: rotation,
        scale: scale,
        ObjId: objId,
        id: '',
        name: '',
        prefab: prefab,
    };
    switch (prefab) {
        case mod.RuntimeSpawn_Common.InteractPoint:
            const interactPoint = obj;
            interactPoint.type = 'InteractPoint';
            interactPoint.enabled = true;
            interactPoints[objId] = interactPoint;
            break;
        default:
            modSimObjects[objId] = obj;
            break;
    }
    return obj;
}
function UnspawnObject(obj) {
    const objId = obj.ObjId;
    if (modSimObjects[objId])
        delete modSimObjects[objId];
    if (interactPoints[objId])
        delete interactPoints[objId];
}
function LoadLevel(script, mapData) {
    modscript = script;
    if (!mapData.Portal_Dynamic) {
        console.warn('Portal_Dynamic not found in map data');
        return;
    }
    const entityTypes = [volumeType];
    mapData.Portal_Dynamic.forEach((obj) => {
        // see if obj.type is in entityTypes
        if (entityTypes.indexOf(obj.type) !== -1) {
            console.log('Loading entity type:', obj.type);
        }
        else {
            if (obj.ObjId === undefined) {
                obj.ObjId = 0;
            }
            if (obj.position)
                obj.position = CreateVector(obj.position.x, obj.position.y, obj.position.z);
            if (obj.right)
                obj.right = CreateVector(obj.right.x, obj.right.y, obj.right.z);
            if (obj.up)
                obj.up = CreateVector(obj.up.x, obj.up.y, obj.up.z);
            if (obj.front)
                obj.front = CreateVector(obj.front.x, obj.front.y, obj.front.z);
        }
        switch (obj.type) {
            case spawnerType:
                obj.type = 'Spawner';
                aiSpawners[obj.ObjId] = obj;
                break;
            case spawnPointType:
                // Spawn points are entities indexed by their string ID
                spawnPoints[obj.id] = obj;
                break;
            case hqType:
                obj.type = 'HeadQuarters';
                if (obj.Team)
                    if (obj.Team === 'TeamNeutral')
                        obj.team = 0;
                    else
                        obj.team = parseInt(obj.Team.replace('Team', ''), 10);
                else
                    obj.team = 1;
                if (!obj.InfantrySpawns) {
                    obj.InfantrySpawns = [];
                }
                if (!obj.HQEnabled)
                    obj.HQEnabled = true;
                hqs[obj.ObjId] = obj;
                break;
            case playerSpawnerType:
                obj.type = 'PlayerSpawner';
                if (!obj.SpawnPoints) {
                    obj.SpawnPoints = [];
                }
                playerSpawners[obj.ObjId] = obj;
                break;
            case interactPointType:
                const interactPoint = obj;
                interactPoint.type = 'InteractPoint';
                interactPoints[obj.ObjId] = interactPoint;
                break;
            case worldIconType:
                worldIcons[obj.ObjId] = obj;
                break;
            case mcomType:
                const mcom = obj;
                mcoms[obj.ObjId] = mcom;
                break;
            case capturePointType:
                const capturePoint = obj;
                capturePoints[obj.ObjId] = capturePoint;
                capturePoint.captureRadius = 10; // hardcoded for now
                capturePoint.currentPlayersInArea = [];
                capturePoint.captureProgress = 0;
                capturePoint.currentOwnerTeam = GetTeam(0);
                allCapturePoints.array.push(capturePoint);
                break;
            case sectorType:
                const sector = obj;
                sectors[obj.ObjId] = sector;
                if (!obj.SectorEnabled)
                    obj.SectorEnabled = true;
                break;
            case volumeType:
                const volume = obj;
                volumes[volume.id] = volume;
                break;
            default:
                modSimObjects[obj.ObjId] = obj;
                break;
        }
    });
}
function* AllLevelObjects() {
    // Iterate through spawners
    for (const objId in aiSpawners) {
        const obj = aiSpawners[objId];
        if (obj) {
            yield obj;
        }
    }
    // Iterate through interact points
    for (const objId in interactPoints) {
        const obj = interactPoints[objId];
        if (obj) {
            yield obj;
        }
    }
    // Iterate through spawn points
    for (const objId in spawnPoints) {
        const obj = spawnPoints[objId];
        if (obj) {
            yield obj;
        }
    }
    // Iterate through player objects
    for (const player of allPlayers.array) {
        yield player;
    }
    // Iterate through MCOMS
    for (const mcomId in mcoms) {
        const mcom = mcoms[mcomId];
        if (mcom) {
            yield mcom;
        }
    }
    // Iterate through Capture Points
    for (const objId in capturePoints) {
        const cp = capturePoints[objId];
        if (cp) {
            yield cp;
        }
    }
    // Iterate through regular objects
    for (const objId in modSimObjects) {
        const obj = modSimObjects[objId];
        if (obj) {
            yield obj;
        }
    }
}
function* GetInteractPoints() {
    // Iterate through interact points
    for (const objId in interactPoints) {
        const obj = interactPoints[objId];
        if (obj) {
            yield obj;
        }
    }
}
function AddPlayer() {
    const player = CreatePlayer();
    allPlayers.array.push(player);
    const onPlayerJoinGame = modscript['OnPlayerJoinGame'];
    if (onPlayerJoinGame) {
        console.log('Calling OnPlayerJoinGame');
        onPlayerJoinGame(player);
    }
    else {
        console.log('OnPlayerJoinGame not found');
    }
    return player;
}
function StartGameMode() {
    gameModeStarted = true;
    gameModeTime = 0;
    const onGameModeStarted = modscript.OnGameModeStarted;
    if (onGameModeStarted) {
        const result = onGameModeStarted();
        if (result && typeof result.then === 'function') {
            result.then(() => {
                console.log('Game mode started');
            });
        }
        else {
            console.log('Game mode started');
        }
    }
    else {
        console.log('OnGameModeStarted not found');
    }
}
function SendPlayerUIButtonEvent(player, widget, eventType) {
    if (modscript.OnPlayerUIButtonEvent) {
        modscript.OnPlayerUIButtonEvent(player, widget, eventType);
    }
    else {
        console.warn('OnPlayerUIButtonEvent not defined');
    }
}
function GetInteractPoint(objId) {
    return interactPoints[objId];
}
function EnableInteractPoint(interactPoint, enable) {
    interactPoint.enabled = enable;
}
function GetWorldIcon(objId) {
    const worldIcon = worldIcons[objId];
    return worldIcon;
}
function SetWorldIconPosition(worldIcon, position) {
    if (!worldIcon) {
        console.warn('SetWorldIconPosition: worldIcon is undefined');
        return;
    }
    worldIcon.position = position;
}
function SetWorldIconText(worldIcon, newText) {
    if (!worldIcon) {
        console.warn('SetWorldIconText: worldIcon is undefined');
        return;
    }
    worldIcon.text = newText.text;
}
function SetWorldIconColor(worldIcon, newColor) {
    if (!worldIcon) {
        console.warn('SetWorldIconColor: worldIcon is undefined');
        return;
    }
    worldIcon.color = newColor;
}
function SetWorldIconImage(worldIcon, image) {
    if (!worldIcon) {
        console.warn('SetWorldIconImage: worldIcon is undefined');
        return;
    }
    worldIcon.image = image;
}
function EnableWorldIconImage(worldIcon, enableImage) {
    if (!worldIcon) {
        console.warn('EnableWorldIconImage: worldIcon is undefined');
        return;
    }
    worldIcon.enableImage = enableImage;
}
function EnableWorldIconText(worldIcon, enableText) {
    if (!worldIcon) {
        console.warn('EnableWorldIconText: worldIcon is undefined');
        return;
    }
    worldIcon.enableText = enableText;
}
function SetWorldIconOwner(worldIcon, owner) {
    if (!worldIcon) {
        console.warn('SetWorldIconOwner: worldIcon is undefined');
        return;
    }
    worldIcon.team = owner.ObjId;
}
function SpawnPlayerFromSpawnPoint(p, objId) {
    const player = p;
    if (!player.deployEnabled) {
        console.warn(`SpawnPlayerFromSpawnPoint: Deployment is disabled for player ${player.name}`);
    }
    player.isAlive = true;
    player.soldier = {
        type: 'Soldier',
        weaponsSlots: {},
    };
    const playerSpawner = playerSpawners[objId];
    if (playerSpawner && playerSpawner.SpawnPoints.length > 0) {
        // Select a random spawn point from the PlayerSpawner
        const randomIndex = Math.floor(Math.random() * playerSpawner.SpawnPoints.length);
        const spawnPointStringId = playerSpawner.SpawnPoints[randomIndex];
        const spawnPoint = spawnPoints[spawnPointStringId];
        if (spawnPoint) {
            player.position = spawnPoint.position;
        }
        else {
            console.warn(`SpawnPlayerFromSpawnPoint: No spawn point found with string ID ${spawnPointStringId}, deploying at origin`);
            player.position = CreateVector(0, 0, 0);
        }
    }
    else {
        console.warn(`SpawnPlayerFromSpawnPoint: No PlayerSpawner found with ID ${objId}, deploying at origin`);
        player.position = CreateVector(0, 0, 0);
    }
    if (modscript.OnPlayerDeployed) {
        modscript.OnPlayerDeployed(player);
    }
    else {
        console.info('OnPlayerDeployed not defined by script');
    }
}
function CameraSetActive(camera, player) {
    const c = camera;
    c.active = true;
    c.player = player;
}
function GlobalVariable(n) {
    return {
        isGlobal: true,
        index: n,
    };
}
function ObjectVariable(object, n) {
    return {
        isGlobal: false,
        index: n,
        object: object,
    };
}
const globalVariables = [];
const playerVariables = [];
const teamVariables = [];
const objectVariablesMap = {
    Player: playerVariables,
    Team: teamVariables,
};
function SetVariable(variable, value) {
    if (variable.isGlobal) {
        while (globalVariables.length <= variable.index) {
            globalVariables.push(undefined);
        }
        globalVariables[variable.index] = value;
    }
    else {
        const objectVariables = objectVariablesMap[variable.object.type];
        while (objectVariables.length <= variable.index) {
            objectVariables.push(undefined);
        }
        objectVariables[variable.index] = value;
    }
}
function GetVariable(variable) {
    if (variable.isGlobal) {
        return globalVariables[variable.index];
    }
    else {
        const type = variable.object.type;
        const objectVariables = objectVariablesMap[type];
        if (variable.index >= objectVariables.length) {
            return undefined;
        }
        return objectVariables[variable.index];
    }
}
let targetScore = 100;
function SetGameModeTargetScore(score) {
    targetScore = score;
}
function Equals(a, b) {
    if (typeof a === 'object' && typeof b === 'object') {
        const aObj = a;
        const bObj = b;
        return a.ObjId === b.ObjId && aObj.type === bObj.type;
    }
    return a === b;
}
function And(a, b) {
    return a && b;
}
function Or(a, b) {
    return a || b;
}
function Not(a) {
    return !a;
}
function Subtract(a, b) {
    return a - b;
}
function RoundToInteger(value) {
    return Math.round(value);
}
function Modulo(a, b) {
    return a % b;
}
function Divide(a, b) {
    return a / b;
}
function Floor(value) {
    return Math.floor(value);
}
function Multiply(a, b) {
    return a * b;
}
function Add(a, b) {
    return a + b;
}
function NotEqualTo(a, b) {
    return !Equals(a, b);
}
function RandomValueInArray(array) {
    if (array.array.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * array.array.length);
    return array.array[randomIndex];
}
function ClosestPlayerTo(arg0, team) {
    const allPlayers = mod.AllPlayers();
    const playerCount = mod.CountOf(allPlayers);
    let closestDist = Infinity;
    let closestPayer = undefined;
    for (let i = 0; i < playerCount; i++) {
        const player = mod.ValueInArray(allPlayers, i);
        if (team && player.team !== team.ObjId)
            continue;
        const distance = mod.DistanceBetween(arg0, player.position);
        if (distance < closestDist) {
            closestDist = distance;
            closestPayer = player;
        }
    }
    return closestPayer;
}
function IsPlayerValid(player) {
    if (!player)
        return false;
    return true;
}
function SetPlayerArmorType(player, armorType) {
    player.armorType = armorType;
}
function RemovePlayerInventoryAtSlot(player, slot) {
    player.inventory[slot] = undefined;
}
var InventoryEnum;
(function (InventoryEnum) {
    InventoryEnum[InventoryEnum["PrimaryWeapons"] = 0] = "PrimaryWeapons";
    InventoryEnum[InventoryEnum["SecondaryWeapons"] = 1] = "SecondaryWeapons";
    InventoryEnum[InventoryEnum["OpenGadgets"] = 2] = "OpenGadgets";
    InventoryEnum[InventoryEnum["MeleeWeapons"] = 3] = "MeleeWeapons";
    InventoryEnum[InventoryEnum["Throwables"] = 4] = "Throwables";
    InventoryEnum[InventoryEnum["MiscGadgets"] = 5] = "MiscGadgets";
    InventoryEnum[InventoryEnum["MedGadgets"] = 6] = "MedGadgets";
})(InventoryEnum || (exports.InventoryEnum = InventoryEnum = {}));
function ReplacePlayerInventory(player, weapon) {
    const weaponNum = weapon;
    let inventoryEnum;
    if (weaponNum < 100)
        inventoryEnum = InventoryEnum.PrimaryWeapons;
    else if (weaponNum < 200) {
        inventoryEnum = InventoryEnum.SecondaryWeapons;
    }
    else if (weaponNum < 300) {
        inventoryEnum = InventoryEnum.OpenGadgets;
    }
    else if (weaponNum < 400) {
        inventoryEnum = InventoryEnum.MeleeWeapons;
    }
    else if (weaponNum < 500) {
        inventoryEnum = InventoryEnum.Throwables;
    }
    else if (weaponNum < 600) {
        inventoryEnum = InventoryEnum.MiscGadgets;
    }
    else if (weaponNum < 700) {
        inventoryEnum = InventoryEnum.MedGadgets;
    }
    else {
        console.error(`ReplacePlayerInventory: Unknown weapon enum ${weapon}`);
        return;
    }
    // I doubt this slot logic is correct
    let slot;
    switch (inventoryEnum) {
        case InventoryEnum.PrimaryWeapons:
            slot = InventorySlots.PrimaryWeapon;
            break;
        case InventoryEnum.SecondaryWeapons:
            slot = InventorySlots.SecondaryWeapon;
            break;
        case InventoryEnum.OpenGadgets:
            slot = InventorySlots.GadgetOne;
            break;
        case InventoryEnum.MeleeWeapons:
            slot = InventorySlots.MeleeWeapon;
            break;
        case InventoryEnum.Throwables:
            slot = InventorySlots.GadgetOne;
            break;
        case InventoryEnum.MiscGadgets:
            slot = InventorySlots.GadgetTwo;
            break;
        case InventoryEnum.MedGadgets:
            slot = InventorySlots.ClassGadget;
            break;
        default:
            console.error(`ReplacePlayerInventory: Unknown inventory enum ${inventoryEnum}`);
            return;
    }
    player.inventory[slot] = weaponNum;
}
function SetInventoryAmmo(player) {
    console.warn('SetInventoryAmmo not implemented');
}
function SetInventoryMagazineAmmo(player) {
    console.warn('SetInventoryMagazineAmmo not implemented');
}
function ForceSwitchInventory(player, inventorySlot) {
    console.warn('ForceSwitchInventory not implemented');
    const soldier = player.soldier;
    if (!soldier) {
        console.warn('ForceSwitchInventory: player has no soldier');
        return;
    }
    const weaponInSlot = soldier.weaponsSlots[inventorySlot];
    if (weaponInSlot === null || weaponInSlot === undefined) {
        console.warn(`ForceSwitchInventory: No weapon in slot ${inventorySlot}`);
        return;
    }
    console.log(`ForceSwitchInventory: Player ${GetObjId(player)} switched to weapon ${weaponInSlot} in slot ${inventorySlot}`);
    soldier.weapon = weaponInSlot;
}
function DistanceBetween(v1, v2) {
    if (!v1) {
        console.warn('DistanceBetween: v1 is undefined');
        v1 = CreateVector(0, 0, 0);
    }
    if (!v2) {
        console.warn('DistanceBetween: v2 is undefined');
        v2 = CreateVector(0, 0, 0);
    }
    const dx = v1.x - v2.x;
    const dy = 0; // Only sim 2d for now. v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function LessThan(a, b) {
    return a < b;
}
function LessThanEqualTo(a, b) {
    return a <= b;
}
function GreaterThan(a, b) {
    return a > b;
}
function IsType(value, type) {
    if (typeof value === 'string') {
        return type == Types.String;
    }
    if (typeof value === 'number') {
        return type == Types.Number;
    }
    switch (value.type) {
        case 'Vector':
            return type == Types.Vector;
        case 'Team':
            return type == Types.Team;
        case 'Player':
            return type == Types.Player;
        case 'UIWidget':
            return type == Types.UIWidget;
        case 'Objective':
            return type == Types.Objective;
        default:
            console.error(`IsType: Unknown type ${value.type}`);
            break;
    }
    return false;
}
function SetCameraTypeForAll(cameraType) {
    console.warn('SetCameraTypeForAll not implemented');
}
function SetSpectateOnDeath(spectateOnDeath) {
    console.warn('SetSpectateOnDeath not implemented');
}
function RayCast(start, end) {
    console.warn('RayCast not implemented');
}
function PlaySound(sfx, amplitude, playerOrTeam) {
    console.warn('PlaySound not implemented');
}
function GetVehicleState(vehicle, vehicleState) {
    if (vehicleState in VehicleStateVector) {
        return zero;
    }
    else {
        throw new Error(`GetVehicleState: State ${vehicleState} not implemented`);
    }
}
function SetGameModeScore(playerOrTeam, newScore) {
    let team = playerOrTeam;
    if ('Player' in playerOrTeam) {
        let player = playerOrTeam;
        team = GetTeam(player.team);
    }
    const teamNum = team.ObjId;
    gameModeScore[teamNum] = newScore;
}
function PlayVO(voiceOver, event, flag) {
    console.warn('PlayVO not implemented');
}
function IsCurrentMap(map) {
    console.warn('IsCurrentMap not implemented');
    return false;
}
function CreateNewWeaponPackage() {
    return { attachments: [] };
}
function AddAttachmentToWeaponPackage(attachment, weaponPackage) {
    if (weaponPackage && weaponPackage.attachments) {
        weaponPackage.attachments.push(attachment);
    }
}
function RemoveEquipment(player, slotOrWeaponOrGadget) {
    console.log(`RemoveEquipment called for player ${GetObjId(player)}`);
    const soldier = player.soldier;
    if (!soldier) {
        console.warn('RemoveEquipment: player has no soldier');
        return;
    }
    const enumValue = slotOrWeaponOrGadget;
    if (enumValue in InventorySlots) {
        soldier.weaponsSlots[slotOrWeaponOrGadget] = null;
    }
    else {
        console.warn('RemoveEquipment: slotOrWeaponOrGadget is not an InventorySlots enum');
    }
}
function AddEquipment(player, weaponOrGadget, slotOrWeaponPackage, desiredInventorySlot) {
    console.log(`AddEquipment called for player ${GetObjId(player)}`);
    const soldier = player.soldier;
    if (!soldier) {
        console.warn('AddEquipment: player has no soldier');
        return;
    }
    const slotValue = slotOrWeaponPackage;
    if (slotValue in InventorySlots) {
        soldier.weaponsSlots[slotValue] = weaponOrGadget;
    }
    else {
        const slot = InventorySlots.PrimaryWeapon; // default slot
        soldier.weaponsSlots[slot] = weaponOrGadget;
    }
}
function EnableVFX(vfx, enable) {
    console.log(`EnableVFX called for VFX ${vfx.prefab} with enable=${enable}`);
    vfx.enabled = enable;
}
function MoveVFX(vfx, position, rotation) {
    console.log(`MoveVFX called for VFX ${vfx.prefab} to position=${position} rotation=${rotation}`);
    vfx.position = position;
    const matrix = eulerToRotationMatrix(rotation);
    vfx.right = matrix.right;
    vfx.up = matrix.up;
    vfx.front = matrix.front;
}
function LoadMusic(musicPackage) {
    console.log(`LoadMusic called for music package ${enums_1.MusicPackages[musicPackage]}`);
}
function PlayMusic(musicEvent, playerOrTeamOrSquad) {
    console.log(`PlayMusic called for music event ${enums_1.MusicEvents[musicEvent]}`);
}
function SetMusicParam(musicParam, paramValue) {
    console.log(`SetMusicParam called for music param ${enums_1.MusicParams[musicParam]} with value=${paramValue}`);
}
function ForcePlayerToSeat(player, vehicle, seatNumber) {
    console.log(`ForcePlayerToSeat called for player ${GetObjId(player)} to seat ${seatNumber}`);
}
function AISetTarget(aiPlayer, targetPlayer) {
    console.log(`AISetTarget called for AI player ${GetObjId(aiPlayer)} with target ${targetPlayer ? GetObjId(targetPlayer) : 'none'}`);
}
exports.stringkeys = {};
function SetStrings(strings) {
    exports.stringkeys = strings;
}
