// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/actions/index.dart'; // Imports other custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom action code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM ACTION:   alHadeedPush                      ║
// ║  DEPENDENCY:                onesignal_flutter: ^5.2.0         ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// Push notifications through OneSignal.
//
// Run it once when the app opens: in FlutterFlow, on the first page,
// Actions > On Page Load > Custom Action > alHadeedPush.
//
// It asks the phone for permission, then keeps OneSignal told who is
// signed in ("ah-<user id>"). The shop sends to that name: sales to the
// manager, waiting work to each desk, order news to the customer.
//
// It lives on its own, apart from the screens, so the screens build
// whether or not OneSignal is set up.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

// The same address as the screens use.
const String _pushApiBase = 'https://pearlfx.online';

bool _pushStarted = false;
String? _pushWho;

Future alHadeedPush() async {
  // Push needs a phone: the web preview has none.
  if (kIsWeb || _pushStarted) return;
  _pushStarted = true;

  // The OneSignal app id is set by the manager in the shop's Settings.
  String appId = '';
  try {
    final res = await http
        .get(Uri.parse(_pushApiBase).resolve('/api/push/config'))
        .timeout(const Duration(seconds: 15));
    appId = (jsonDecode(res.body) as Map)['appId']?.toString() ?? '';
  } catch (_) {
    // No connection now: try again next time the app opens.
    _pushStarted = false;
    return;
  }
  if (appId.isEmpty) {
    _pushStarted = false;
    return;
  }

  OneSignal.initialize(appId);
  await OneSignal.Notifications.requestPermission(true);

  // Follow whoever signs in or out on this phone.
  Future<void> follow() async {
    final prefs = await SharedPreferences.getInstance();
    String? who;
    final raw = prefs.getString('alhadeed.user');
    if (raw != null && prefs.getString('alhadeed.token') != null) {
      try {
        final id = (jsonDecode(raw) as Map)['id'];
        if (id != null) who = 'ah-$id';
      } catch (_) {}
    }
    if (who == _pushWho) return;
    _pushWho = who;
    if (who == null) {
      OneSignal.logout();
    } else {
      OneSignal.login(who);
    }
  }

  await follow();
  Timer.periodic(const Duration(seconds: 5), (_) => follow());
}
