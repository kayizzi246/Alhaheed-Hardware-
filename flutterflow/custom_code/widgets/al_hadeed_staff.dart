// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedStaff                     ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// FlutterFlow looks for a class with exactly the name typed in the
// "Custom Widget" box. The default is "NewCustomWidget", and leaving
// it there is what produces:
//
//     No widget "NewCustomWidget" found.
//
// So set the name field to:
//
//     AlHadeedStaff
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// The desks on a phone — cashier, accounts, store, manager.


// The shared core below is identical in all five screen files, so each
// file carries a few helpers it does not use itself. That is an analyzer
// warning, not an error, and silencing it keeps real warnings visible.
// ignore_for_file: unused_element

import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════
//  WHERE THE API LIVES
//
//  The one line to change when you deploy. Must match the value in
//  al_hadeed_shop.dart, al_hadeed_cart.dart,
//  al_hadeed_orders.dart and al_hadeed_company.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'https://pearlfx.online';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_manager.dart' show AlHadeedManager;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF5F7FB);
const Color _ink = Color(0xFF0F1B33);
const Color _inkSoft = Color(0xFF394862);
const Color _mid = Color(0xFF55637D);
const Color _light = Color(0xFF626F88);
const Color _hairline = Color(0xFFE2E8F2);
const Color _tile = Color(0xFFF9FAFD);
const Color _navy = Color(0xFF111C38);
const Color _navyDark = Color(0xFF0A1226);
const Color _brand = Color(0xFF2158E8);
const Color _brandDark = Color(0xFF1B46C2);
const Color _brandPale = Color(0xFFEDF3FF);
const Color _green = Color(0xFF0E7444);
const Color _greenPale = Color(0xFFE6F6ED);
const Color _blue = Color(0xFF0B658D);
const Color _bluePale = Color(0xFFE3F3FB);
const Color _amber = Color(0xFF9A5205);
const Color _amberPale = Color(0xFFFEF3E0);
const Color _ember = Color(0xFFC02B2B);
const Color _emberPale = Color(0xFFFDECEC);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

/// Soft depth for cards: a tight contact shadow and a wide faint one —
/// the same layered shadow the staff panel's cards use.
const List<BoxShadow> _cardShadow = [
  BoxShadow(color: Color(0x0A0F1B33), blurRadius: 2, offset: Offset(0, 1)),
  BoxShadow(
      color: Color(0x140F1B33),
      blurRadius: 24,
      spreadRadius: -10,
      offset: Offset(0, 8)),
];

/// The brand's blue, deepening — hero cards, the header, the add button.
const LinearGradient _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF2E67EE), Color(0xFF1B46C2)],
);

double _ui = 1.0;

bool get _isApple =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS);

double _trackingFor(double s) {
  if (s >= 24) return -0.025;
  if (s >= 20) return -0.020;
  if (s >= 17) return -0.013;
  if (s >= 15) return -0.007;
  if (s >= 13) return 0.0;
  return 0.008;
}

TextStyle _font(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = _inkSoft,
  double height = 1.3,
}) {
  final s = size * _ui;
  return TextStyle(
    fontFamily: _isApple ? (s >= 20 ? '.SF Pro Display' : '.SF Pro Text') : null,
    fontFamilyFallback: _isApple
        ? const ['.SF UI Display', '.SF UI Text', 'Helvetica Neue']
        : null,
    fontSize: s,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: s * _trackingFor(s),
  );
}

TextStyle _title(double size,
        {FontWeight weight = FontWeight.w700, Color color = _ink}) =>
    _font(size, weight: weight, color: color, height: 1.15);

TextStyle _txt(double size,
        {FontWeight weight = FontWeight.w400,
        Color color = _inkSoft,
        double height = 1.3}) =>
    _font(size, weight: weight, color: color, height: height);

BoxDecoration _liquid({
  Color? tint,
  bool onDark = false,
  double radius = 999,
  bool circle = false,
}) {
  final List<Color> fill;
  final Color rim;
  if (tint != null) {
    fill = [Color.lerp(tint, _white, 0.10)!, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.30), _white.withOpacity(0.12)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, Color(0xFFEFF2F5)];
    rim = _ink.withOpacity(0.10);
  }
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: fill,
    ),
    shape: circle ? BoxShape.circle : BoxShape.rectangle,
    borderRadius: circle ? null : BorderRadius.circular(radius),
    border: Border.all(color: rim, width: 1),
  );
}

class _GradientRim extends BoxBorder {
  const _GradientRim(this.gradient, {this.width = 1});

  final Gradient gradient;
  final double width;

  @override
  BorderSide get top => BorderSide.none;
  @override
  BorderSide get bottom => BorderSide.none;
  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(width);
  @override
  bool get isUniform => true;

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    ui.TextDirection? textDirection,
    BoxShape shape = BoxShape.rectangle,
    BorderRadius? borderRadius,
  }) {
    final paint = Paint()
      ..strokeWidth = width
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke;
    final inner = rect.deflate(width / 2);
    if (borderRadius != null) {
      canvas.drawRRect(borderRadius.toRRect(inner), paint);
    } else {
      canvas.drawRect(inner, paint);
    }
  }

  @override
  ShapeBorder scale(double t) => _GradientRim(gradient, width: width * t);
}

class _Glass extends StatelessWidget {
  const _Glass({
    required this.child,
    this.height,
    this.radius = 22,
    this.blur = 24,
    this.padding,
  });

  final Widget child;
  final double? height;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_white.withOpacity(0.86), _white.withOpacity(0.66)],
              ),
              border: _GradientRim(
                LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_white.withOpacity(0.95), _ink.withOpacity(0.12)],
                ),
              ),
            ),
            child: child,
          ),
        ),
      );
}

class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, this.onTap, this.scale = 0.96});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onTap!();
              },
        child: AnimatedScale(
          scale: _down ? widget.scale : 1.0,
          duration: Duration(milliseconds: _down ? 100 : 160),
          curve: _ease,
          child: widget.child,
        ),
      );
}

class _Skeleton extends StatefulWidget {
  const _Skeleton(this.width, this.height, {this.radius = 12});

  final double width;
  final double height;
  final double radius;

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          width: widget.width == 0 ? null : widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(_tile, _hairline, _c.value),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
}

/// A text field styled to match the tiles, with no Material underline
/// or outline fighting the flat look.
class _Field extends StatelessWidget {
  const _Field({
    super.key,
    required this.controller,
    this.obscure = false,
    required this.hint,
    this.validator,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.autofocus = false,
    this.onChanged,
    this.capitalisation = TextCapitalization.none,
  });

  final TextEditingController controller;
  final bool obscure;
  final String hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool autofocus;
  final ValueChanged<String>? onChanged;
  final TextCapitalization capitalisation;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        validator: validator,
        obscureText: obscure,
        autocorrect: !obscure,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        autofocus: autofocus,
        onChanged: onChanged,
        textCapitalization: capitalisation,
        cursorColor: _brand,
        style: _txt(15, color: _ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: _txt(15, color: _light),
          counterText: '',
          filled: true,
          fillColor: _tile,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _brand, width: 1.5),
          ),
          errorStyle: _txt(12, color: _ember),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  THE API
// ═══════════════════════════════════════════════════════════════

class _ApiError implements Exception {
  _ApiError(this.message, {this.unauthorised = false, this.code});
  final String message;
  final String? code;
  final bool unauthorised;
  @override
  String toString() => message;
}

/// The API answers `{ ...data }` or `{ "error": "in plain words" }`, so a
/// failure arrives with the wording the server wrote — including the
/// spending-limit and out-of-stock messages, which explain themselves far
/// better than a status code would.
Map<String, dynamic> _unwrap(http.Response res) {
  Map<String, dynamic> body;
  try {
    body = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {
    throw _ApiError('The server sent something unexpected. Try again.');
  }

  final error = body['error'];
  if (error != null) {
    throw _ApiError(
      error is String ? error : 'Something went wrong.',
      unauthorised: res.statusCode == 401,
      code: body['code']?.toString(),
    );
  }
  return body;
}

Map<String, String> _headers({bool json = false}) => {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      if (_Session().token != null)
        'Authorization': 'Bearer ${_Session().token}',
    };

Future<Map<String, dynamic>> _apiGet(String path) async {
  try {
    final res = await http
        .get(Uri.parse(_apiBase).resolve(path), headers: _headers())
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiSend(
    String method, String path, Object body) async {
  try {
    final uri = Uri.parse(_apiBase).resolve(path);
    final headers = _headers(json: true);
    final payload = jsonEncode(body);
    final res = await switch (method) {
      'PATCH' => http.patch(uri, headers: headers, body: payload),
      'DELETE' => http.delete(uri, headers: headers, body: payload),
      _ => http.post(uri, headers: headers, body: payload),
    }
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiPost(String path, Object body) =>
    _apiSend('POST', path, body);

// ═══════════════════════════════════════════════════════════════
//  MONEY
// ═══════════════════════════════════════════════════════════════

String _ugx(int amount) =>
    'UGX ${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

String _shortUgx(int amount) {
  if (amount >= 1000000) {
    final m = amount / 1000000;
    final t = m >= 100 || m == m.roundToDouble()
        ? m.round().toString()
        : m.toStringAsFixed(1);
    return 'UGX ${t}M';
  }
  if (amount >= 1000) return 'UGX ${(amount / 1000).round()}K';
  return 'UGX $amount';
}

/// "09:26" from the API's "2026-11-19 09:26:41".
String _shortTime(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  return stamp.substring(11, 16);
}

/// "19 Nov, 09:26" — enough to tell two orders apart without the year
/// taking up half the row.
String _when(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final month = int.tryParse(stamp.substring(5, 7)) ?? 1;
  final day = stamp.substring(8, 10);
  return '${int.parse(day)} ${months[month - 1]}, ${stamp.substring(11, 16)}';
}

// ═══════════════════════════════════════════════════════════════
//  WHO IS SIGNED IN
// ═══════════════════════════════════════════════════════════════

/// The signed-in customer, kept on the phone so the app opens straight
/// into the shop rather than asking for a code every time.
class _Session extends ChangeNotifier {
  factory _Session() => _instance;
  _Session._();
  static final _Session _instance = _Session._();

  static const _kToken = 'alhadeed.token';
  static const _kUser = 'alhadeed.user';

  SharedPreferences? _prefs;
  String? token;
  Map<String, dynamic>? user;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs!.getString(_kToken);
    final raw = _prefs!.getString(_kUser);
    if (raw != null) {
      try {
        user = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        user = null;
      }
    } else {
      user = null;
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;

  /// 'customer', or the desk: 'store' | 'cashier' | 'accounts' | 'manager'.
  String get role => user?['role'] as String? ?? 'customer';
  bool get isStaff => signedIn && role != 'customer';
  String get fullName => user?['fullName'] as String? ?? '';
  String get phone => user?['phone'] as String? ?? '';
  String get accountType => user?['accountType'] as String? ?? 'individual';
  bool get isCompany => accountType != 'individual';
  bool get isCompanyOwner => accountType == 'company_owner';
  String? get staffRole => user?['staffRole'] as String?;
  int? get spendingLimit => (user?['spendingLimit'] as num?)?.toInt();
  // The sign-in response carries companyId but not the company's name, so
  // the name is fetched from /auth/me right after signing in and kept
  // alongside it. Both shapes are read here so an older stored session
  // still shows something sensible.
  String get companyName =>
      user?['companyName'] as String? ??
      (user?['company'] as Map<String, dynamic>?)?['company_name']
          as String? ??
      'Company account';

  /// The line under the logo. A company's buyer can see at a glance
  /// whose account an order will land on.
  String get subtitle {
    if (!signedIn) return 'Browse the shop, sign in to order';
    if (!isCompany) return fullName;
    if (isCompanyOwner) return '$companyName · Owner view';
    return '$companyName · ordering as $fullName'
        '${staffRole == null ? '' : ' ($staffRole)'}';
  }

  Future<void> save(String newToken, Map<String, dynamic> newUser) async {
    _prefs ??= await SharedPreferences.getInstance();
    token = newToken;
    user = newUser;
    await _prefs!.setString(_kToken, newToken);
    await _prefs!.setString(_kUser, jsonEncode(newUser));
    notifyListeners();
  }

  Future<void> signOut() async {
    _prefs ??= await SharedPreferences.getInstance();
    token = null;
    user = null;
    await _prefs!.remove(_kToken);
    await _prefs!.remove(_kUser);
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE CART
// ═══════════════════════════════════════════════════════════════

/// Kept on the phone, not on the server: a cart is a private scribble
/// until it is submitted, and losing it to a dropped connection on the
/// way to the shop would be its own small disaster.
class _CartStore extends ChangeNotifier {
  factory _CartStore() => _instance;
  _CartStore._();
  static final _CartStore _instance = _CartStore._();

  static const _key = 'alhadeed.cart';
  SharedPreferences? _prefs;
  List<Map<String, dynamic>> lines = [];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      try {
        lines = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      } catch (_) {
        lines = [];
      }
    }
    notifyListeners();
  }

  Future<void> _save() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_key, jsonEncode(lines));
    notifyListeners();
  }

  int get count => lines.fold(0, (n, l) => n + (l['quantity'] as int));

  int get subtotal =>
      lines.fold(0, (n, l) => n + (l['price'] as int) * (l['quantity'] as int));

  int quantityOf(int productId) {
    for (final l in lines) {
      if (l['productId'] == productId) return l['quantity'] as int;
    }
    return 0;
  }

  Future<void> add(Map<String, dynamic> product, int quantity) async {
    final id = (product['id'] as num).toInt();
    final existing = lines.indexWhere((l) => l['productId'] == id);
    if (existing >= 0) {
      lines[existing]['quantity'] =
          (lines[existing]['quantity'] as int) + quantity;
    } else {
      lines.add({
        'productId': id,
        'name': product['name'],
        'unit': product['unit'],
        'code': product['code'],
        'category': product['category_name'],
        'price': (product['price'] as num).toInt(),
        'quantity': quantity,
      });
    }
    await _save();
  }

  Future<void> setQuantity(int productId, int quantity) async {
    final i = lines.indexWhere((l) => l['productId'] == productId);
    if (i < 0) return;
    if (quantity <= 0) {
      lines.removeAt(i);
    } else {
      lines[i]['quantity'] = quantity;
    }
    await _save();
  }

  Future<void> clear() async {
    lines = [];
    await _save();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED PIECES
// ═══════════════════════════════════════════════════════════════

/// A colour per category, so cement is always grey-blue and paint is
/// always violet. Hashed from the name rather than hard-coded, because
/// the Manager can add a category on the web panel at any time.
Color _categoryColour(String? name) {
  const palette = [
    Color(0xFF4A6E8A),
    Color(0xFF8A5A3C),
    Color(0xFF3F7F6B),
    Color(0xFF8A6FAE),
    Color(0xFF2F6E9E),
    Color(0xFFB07A2A),
    Color(0xFF5B6E7F),
  ];
  if (name == null || name.isEmpty) return palette[0];
  var h = 0;
  for (final c in name.codeUnits) {
    h = (h * 31 + c) & 0x7FFFFFFF;
  }
  return palette[h % palette.length];
}

/// One colour pair per status, used on every screen, so a chip means the
/// same thing wherever it turns up.
(Color, Color) _statusColours(String status) => switch (status) {
      'pending_payment' => (_amberPale, _amber),
      'paid' => (_bluePale, _blue),
      'payment_verified' => (_bluePale, _blue),
      'packed' => (_bluePale, _blue),
      'released' => (_greenPale, _green),
      'cancelled' => (_emberPale, _ember),
      'rejected' => (_emberPale, _ember),
      _ => (_tile, _mid),
    };

String _statusLabel(String status) => switch (status) {
      'pending_payment' => 'Pending payment',
      'paid' => 'Paid',
      'payment_verified' => 'Verifying',
      'packed' => 'Being packed',
      'released' => 'Completed',
      'cancelled' => 'Cancelled',
      'rejected' => 'Payment rejected',
      _ => status,
    };

class _Chip extends StatelessWidget {
  const _Chip(this.label,
      {required this.bg, required this.fg, this.bold = true});

  final String label;
  final Color bg;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: _txt(11.5,
              weight: bold ? FontWeight.w700 : FontWeight.w500, color: fg),
        ),
      );
}

/// The bottom bar. Four screens, and everything else the app does is a
/// sheet that slides over whichever one you are on — so you never lose
/// your place to look something up.
///
/// The other three screens are reached by their widget class, which is
/// the only thing FlutterFlow lets cross between custom widget files.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current});

  /// 'shop' | 'cart' | 'orders' | 'company'
  final String current;

  void _go(BuildContext context, Widget page) =>
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => page,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ));

  @override
  Widget build(BuildContext context) {
    final owner = _Session().isCompanyOwner;
    // Outline when idle, filled where you are.
    final items = <(String, String, IconData, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, Icons.storefront_rounded,
          const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined,
          Icons.shopping_cart_rounded, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined,
          Icons.receipt_long_rounded, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        owner ? Icons.business_rounded : Icons.person_rounded,
        const AlHadeedCompany()
      ),
    ];

    // A floating bar rather than a slab across the bottom: it sits on
    // the page, and the tab you are on is lit by a soft pill.
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 6, 16, MediaQuery.paddingOf(context).bottom + 10),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _hairline),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0D0F1B33), blurRadius: 3, offset: Offset(0, 1)),
            BoxShadow(
                color: Color(0x1F0F1B33),
                blurRadius: 30,
                spreadRadius: -10,
                offset: Offset(0, 14)),
          ],
        ),
        child: Row(
          children: [
            for (final (key, label, icon, iconOn, page) in items)
              Expanded(
                child: _Pressable(
                  scale: 0.94,
                  onTap: key == current ? null : () => _go(context, page),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: _ease,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color:
                          key == current ? _brandPale : _white.withOpacity(0),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(key == current ? iconOn : icon,
                                size: 23,
                                color: key == current ? _brand : _light),
                            if (key == 'cart')
                              ListenableBuilder(
                                listenable: _CartStore(),
                                builder: (_, __) {
                                  final n = _CartStore().count;
                                  if (n == 0) return const SizedBox.shrink();
                                  return Positioned(
                                    right: -9,
                                    top: -6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        gradient: _heroGradient,
                                        borderRadius: BorderRadius.circular(9),
                                        border:
                                            Border.all(color: _white, width: 2),
                                      ),
                                      constraints:
                                          const BoxConstraints(minWidth: 19),
                                      child: Text('$n',
                                          textAlign: TextAlign.center,
                                          style: _txt(10,
                                              weight: FontWeight.w800,
                                              color: _white)),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(label,
                            style: _txt(10.5,
                                weight: key == current
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: key == current ? _brand : _light)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// The header every screen wears: the brand's blue, rounded at its foot.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF245CEC), Color(0xFF182D70)],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
          boxShadow: [
            BoxShadow(
                color: Color(0x332158E8),
                blurRadius: 24,
                spreadRadius: -8,
                offset: Offset(0, 10)),
          ],
        ),
        child: Stack(
          children: [
            // A soft light in the corner, so the blue has depth rather
            // than being a flat slab.
            Positioned(
              right: -60,
              top: -90,
              child: Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    _white.withOpacity(0.22),
                    _white.withOpacity(0),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, MediaQuery.paddingOf(context).top + 14, 16, 20),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _white.withOpacity(0.16),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _white.withOpacity(0.24)),
                    ),
                    child: Text('AH',
                        style: _title(14,
                            weight: FontWeight.w800, color: _white)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Al Hadeed Hardware',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _title(17,
                                weight: FontWeight.w800, color: _white)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _txt(12.5, color: _white.withOpacity(0.92))),
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          ],
        ),
      );
}

/// Every screen's "nothing here yet" and "that did not work" state.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.line,
    this.action,
    this.onAction,
    this.tone = _mid,
  });

  final IconData icon;
  final String title;
  final String line;
  final String? action;
  final VoidCallback? onAction;
  final Color tone;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // A soft rounded tile with a ring, not a flat grey disc.
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: tone == _ember
                        ? [_emberPale, _white]
                        : [_brandPale, _white],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                      color: tone == _ember
                          ? _ember.withOpacity(0.18)
                          : _brand.withOpacity(0.14)),
                  boxShadow: _cardShadow,
                ),
                child: Icon(icon,
                    size: 32, color: tone == _ember ? _ember : _brand),
              ),
              const SizedBox(height: 16),
              Text(title, textAlign: TextAlign.center, style: _title(19)),
              const SizedBox(height: 8),
              Text(line,
                  textAlign: TextAlign.center,
                  style: _txt(13.5, color: _mid, height: 1.5)),
              if (action != null) ...[
                const SizedBox(height: 20),
                _Pressable(
                  scale: 0.98,
                  onTap: onAction,
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    alignment: Alignment.center,
                    decoration: _liquid(tint: _brand, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _white)),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

/// The shell every sheet in the app sits in: grab handle, rounded top,
/// lifted clear of the keyboard.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    return Padding(
      // Lifts the sheet above the keyboard, or the submit button sits
      // under it and cannot be reached.
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        clipBehavior: Clip.antiAlias,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                decoration: BoxDecoration(
                  color: _hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE STAFF SIDE
// ═══════════════════════════════════════════════════════════════

/// What staff see instead of the shop.
///
/// The customer screens hand over to this the moment the session belongs
/// to a desk. It replaces them rather than being opened on top, so there
/// is no shop underneath to go back to; the only way out is signing out.
/// Each desk gets its own bar. The server checks the desk on every
/// request as well — this decides what is drawn, not what is allowed.
class AlHadeedStaff extends StatefulWidget {
  const AlHadeedStaff({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on.
  final double? width;
  final double? height;

  @override
  State<AlHadeedStaff> createState() => _AlHadeedStaffState();
}

typedef _TabSpec = (String, IconData, IconData, Widget);

class _AlHadeedStaffState extends State<AlHadeedStaff> {
  int _tab = 0;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _Session().load().then((_) {
      if (mounted) setState(() => _ready = true);
    });
  }

  Future<void> _signOut() async {
    final navigator = Navigator.of(context);
    await _Session().signOut();
    await _CartStore().clear();
    if (!mounted) return;
    navigator.pushReplacement(PageRouteBuilder(
      pageBuilder: (_, __, ___) => const AlHadeedShop(),
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
    ));
  }

  List<_TabSpec> get _tabs {
    final desk = _Session().role;
    final out = _signOut;
    final account = (
      'Account',
      Icons.person_outline_rounded,
      Icons.person_rounded,
      _AccountTab(onSignOut: _signOut),
    );
    _ListTab orders(String title, String path, String empty,
            {String? action, bool deliver = false}) =>
        _ListTab(
          title: title,
          path: path,
          listKey: 'orders',
          empty: empty,
          onExpired: out,
          row: (o, reload) => _OrderCard(o, action: action, done: reload),
        );
    _ListTab requests() => _ListTab(
          title: 'Expenses',
          path: '/api/expenses?status=all',
          listKey: 'expenses',
          empty: 'No expenses yet',
          onExpired: out,
          row: (e, reload) => _RequestCard(e, desk: desk, done: reload),
          add: 'Add expense',
          addSheet: (_) => const _RequestSheet(),
        );

    return switch (desk) {
      'store' => [
          (
            'To release',
            Icons.inventory_2_outlined,
            Icons.inventory_2_rounded,
            orders('To release', '/api/store/queue', 'Nothing to release',
                action: 'release')
          ),
          (
            'Released',
            Icons.task_alt_outlined,
            Icons.task_alt_rounded,
            orders('Released', '/api/orders/queue/done', 'Nothing released yet')
          ),
          (
            'Expenses',
            Icons.playlist_add_rounded,
            Icons.playlist_add_check_rounded,
            requests()
          ),
          account,
        ],
      'cashier' => [
          (
            'To pay',
            Icons.payments_outlined,
            Icons.payments_rounded,
            orders('Waiting to pay', '/api/cashier/queue', 'Nobody is waiting',
                action: 'pay')
          ),
          (
            'Receipts',
            Icons.receipt_outlined,
            Icons.receipt_rounded,
            _ListTab(
              title: 'Receipts today',
              path: '/api/cashier/receipts',
              listKey: 'receipts',
              empty: 'No receipts yet today',
              onExpired: out,
              row: (r, _) => _PlainCard(
                title: '${r['receipt_no']} · ${r['order_no'] ?? ''}',
                line: [
                  r['company_name'] ?? r['customer_name'],
                  _method(r['method']),
                  r['transaction_ref'],
                  _shortTime(r['created_at']?.toString()),
                ],
                amount: _int(r['amount_paid']),
              ),
            )
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
      'accounts' => [
          (
            'To verify',
            Icons.fact_check_outlined,
            Icons.fact_check_rounded,
            orders('To verify', '/api/accounts/queue', 'Nothing to check',
                action: 'verify')
          ),
          (
            'Cash book',
            Icons.menu_book_outlined,
            Icons.menu_book_rounded,
            _ListTab(
              title: 'Cash book today',
              path: '/api/accounts/cash-book',
              listKey: 'entries',
              empty: 'Nothing in the book today',
              onExpired: out,
              summary: (d) => [
                ('Opening', _ugx(_int(d['opening']))),
                ('Closing', _ugx(_int(d['closing']))),
              ],
              row: (e, _) => _PlainCard(
                title: e['details']?.toString() ?? '',
                line: [
                  _method(e['method']),
                  _shortTime(e['created_at']?.toString()),
                ],
                amount: _int(e['cash_in']) > 0
                    ? _int(e['cash_in'])
                    : -_int(e['cash_out']),
              ),
            )
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
      _ => [
          (
            'Dashboard',
            Icons.dashboard_outlined,
            Icons.dashboard_rounded,
            const AlHadeedManager()
          ),
          (
            'Orders',
            Icons.receipt_long_outlined,
            Icons.receipt_long_rounded,
            orders('All orders', '/api/orders?limit=100', 'No orders yet')
          ),
          (
            'Expenses',
            Icons.request_quote_outlined,
            Icons.request_quote_rounded,
            requests()
          ),
          account,
        ],
    };
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    if (!_ready || !_Session().signedIn) return Container(color: _bg);

    final tabs = _tabs;
    final at = _tab.clamp(0, tabs.length - 1);

    return PopScope(
      // The phone's back button goes to the first tab, then nowhere: the
      // shop is not behind this.
      canPop: false,
      onPopInvokedWithResult: (did, _) {
        if (!did && _tab != 0) setState(() => _tab = 0);
      },
      child: MediaQuery(
        data: mq.copyWith(
          textScaler:
              mq.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.2),
        ),
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light
              .copyWith(statusBarColor: Colors.transparent),
          child: Container(
            width: widget.width ?? mq.size.width,
            height: widget.height ?? mq.size.height,
            color: _bg,
            child: Scaffold(
              backgroundColor: _bg,
              // Keyed, so each tab asks the shop afresh when opened.
              body: KeyedSubtree(key: ValueKey(at), child: tabs[at].$4),
              bottomNavigationBar: _bar(tabs, at, mq),
            ),
          ),
        ),
      ),
    );
  }

  /// Navy where the customers' bar is white: one glance says which side
  /// of the app this is.
  Widget _bar(List<_TabSpec> tabs, int at, MediaQueryData mq) => Padding(
        padding: EdgeInsets.fromLTRB(16, 6, 16, mq.padding.bottom + 10),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [_navy, _navyDark]),
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x400F1B33),
                  blurRadius: 30,
                  spreadRadius: -10,
                  offset: Offset(0, 14)),
            ],
          ),
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: _Pressable(
                    scale: 0.94,
                    onTap: i == at ? null : () => setState(() => _tab = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: _ease,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: _white.withOpacity(i == at ? 0.16 : 0),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(i == at ? tabs[i].$3 : tabs[i].$2,
                              size: 23,
                              color: _white.withOpacity(i == at ? 1 : 0.75)),
                          const SizedBox(height: 3),
                          Text(tabs[i].$1,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _txt(10.5,
                                  weight: i == at
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color:
                                      _white.withOpacity(i == at ? 1 : 0.75))),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

int _int(Object? v) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? 0;

String _method(Object? m) => switch (m?.toString()) {
      'mobile_money' => 'Mobile Money',
      'cash' => 'Cash',
      'card' => 'Card',
      null || '' => '',
      final other => other,
    };

String _deskName(String role) => switch (role) {
      'store' => 'Store Manager',
      'cashier' => 'Cashier',
      'accounts' => 'Accounts',
      _ => 'Manager',
    };

/// One tab: a header, what the shop answered, and every state between.
class _ListTab extends StatefulWidget {
  const _ListTab({
    required this.title,
    required this.path,
    required this.listKey,
    required this.empty,
    required this.row,
    required this.onExpired,
    this.summary,
    this.add,
    this.addSheet,
  });

  final String title;
  final String path;
  final String listKey;
  final String empty;
  final Widget Function(Map<String, dynamic>, Future<void> Function()) row;
  final Future<void> Function() onExpired;
  final List<(String, String)> Function(Map<String, dynamic>)? summary;
  final String? add;
  final WidgetBuilder? addSheet;

  @override
  State<_ListTab> createState() => _ListTabState();
}

class _ListTabState extends State<_ListTab> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet(widget.path);
      if (!mounted) return;
      setState(() {
        _data = r;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await widget.onExpired();
        return;
      }
      setState(() => _error = e.message);
    }
  }

  Future<void> _add() async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: widget.addSheet!,
    );
    if (done == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final rows = ((_data?[widget.listKey] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();

    return Column(
      children: [
        _Header(
          subtitle:
              '${_deskName(_Session().role)} · ${_Session().fullName}',
          trailing: _Pressable(
            scale: 0.9,
            onTap: _load,
            child: Container(
              width: 38,
              height: 38,
              decoration: _liquid(circle: true, onDark: true),
              child:
                  const Icon(Icons.refresh_rounded, size: 19, color: _white),
            ),
          ),
        ),
        Expanded(
          // A failure is never drawn as an empty list: "nobody is waiting"
          // on a dropped connection would be a lie.
          child: _data == null && _error != null
              ? _Empty(
                  icon: Icons.cloud_off_rounded,
                  tone: _ember,
                  title: 'This could not be loaded',
                  line: _error!,
                  action: 'Try again',
                  onAction: _load,
                )
              : _data == null
                  ? const Center(
                      child: CircularProgressIndicator(color: _brand))
                  : RefreshIndicator(
                      color: _brand,
                      onRefresh: _load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                        children: [
                          Row(
                            children: [
                              Expanded(
                                  child: Text(widget.title,
                                      style: _title(20,
                                          weight: FontWeight.w800))),
                              if (widget.add != null)
                                _SmallButton(widget.add!, _add)
                              else
                                Text('${rows.length}',
                                    style: _title(16, color: _mid)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_error != null) ...[
                            Text('Not up to date: $_error',
                                style: _txt(12.5, color: _ember)),
                            const SizedBox(height: 10),
                          ],
                          if (widget.summary != null)
                            for (final (k, v) in widget.summary!(_data!))
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(children: [
                                  Text(k, style: _txt(13.5, color: _mid)),
                                  const Spacer(),
                                  Text(v, style: _title(15)),
                                ]),
                              ),
                          if (rows.isEmpty)
                            _Empty(
                              icon: Icons.inbox_outlined,
                              title: widget.empty,
                              line: 'Pull down to check again.',
                            ),
                          for (final r in rows) widget.row(r, _load),
                        ],
                      ),
                    ),
        ),
      ],
    );
  }
}

BoxDecoration _cardBox() => BoxDecoration(
      color: _white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _hairline.withOpacity(0.7)),
      boxShadow: _cardShadow,
    );

class _SmallButton extends StatelessWidget {
  const _SmallButton(this.label, this.onTap);
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _Pressable(
        scale: 0.95,
        onTap: onTap,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: _liquid(tint: _brand, radius: 19),
          child: Text(label,
              style: _txt(13, weight: FontWeight.w700, color: _white)),
        ),
      );
}

/// The wide button at the foot of a sheet.
class _BigButton extends StatelessWidget {
  const _BigButton(this.label, this.onTap,
      {this.busy = false, this.tint = _brand, this.soft = false});
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  final Color tint;

  /// For the choice that is not the main one: pale, so two buttons side
  /// by side never shout at once.
  final bool soft;

  @override
  Widget build(BuildContext context) => _Pressable(
        scale: 0.98,
        onTap: busy ? null : onTap,
        child: Opacity(
          opacity: onTap == null && !busy ? 0.45 : 1,
          child: Container(
            height: 50,
            alignment: Alignment.center,
            decoration: soft
                ? BoxDecoration(
                    color: _emberPale,
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(color: tint.withOpacity(0.22)),
                  )
                : _liquid(tint: tint, radius: 25),
            child: busy
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: soft ? tint : _white))
                : Text(label,
                    style: _txt(15,
                        weight: FontWeight.w600,
                        color: soft ? tint : _white)),
          ),
        ),
      );
}

class _PlainCard extends StatelessWidget {
  const _PlainCard(
      {required this.title, required this.line, required this.amount});
  final String title;
  final List<Object?> line;
  final int amount;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: _cardBox(),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: _txt(14, weight: FontWeight.w700)),
                  const SizedBox(height: 3),
                  Text(
                      line
                          .where((x) => x != null && x.toString().isNotEmpty)
                          .join(' · '),
                      style: _txt(12, color: _mid)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(amount < 0 ? '−${_ugx(-amount)}' : _ugx(amount),
                style: _title(14.5, color: amount < 0 ? _ember : _ink)),
          ],
        ),
      );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard(this.order, {this.action, required this.done});
  final Map<String, dynamic> order;

  /// 'pay' | 'verify' | 'release', or null to only look.
  final String? action;
  final Future<void> Function() done;

  Future<void> _open(BuildContext context) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OrderSheet(order: order, action: action),
    );
    if (changed == true) await done();
  }

  @override
  Widget build(BuildContext context) {
    final items = _int(order['item_count']);
    return _Pressable(
      scale: 0.98,
      onTap: () => _open(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: _cardBox(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text('${order['order_no']}',
                  style: _title(16, weight: FontWeight.w800)),
              const Spacer(),
              Text(_ugx(_int(order['total'])),
                  style: _title(16, weight: FontWeight.w800)),
            ]),
            const SizedBox(height: 5),
            Text(
                '${order['company_name'] ?? order['ordered_by_name'] ?? ''}',
                style: _txt(13.5, weight: FontWeight.w600)),
            const SizedBox(height: 4),
            Row(children: [
              Expanded(
                child: Text(
                    [
                      '$items ${items == 1 ? 'item' : 'items'}',
                      _when(order['created_at']?.toString()),
                      if (order['fulfilment'] == 'delivery') 'delivery',
                    ].join(' · '),
                    style: _txt(12, color: _mid)),
              ),
              if (action == null)
                _Chip('${order['status_label'] ?? ''}',
                    bg: _brandPale, fg: _brandDark)
              else
                const Icon(Icons.chevron_right_rounded,
                    size: 20, color: _light),
            ]),
          ],
        ),
      ),
    );
  }
}

/// One order in full, and the one thing this desk does to it.
class _OrderSheet extends StatefulWidget {
  const _OrderSheet({required this.order, this.action});
  final Map<String, dynamic> order;
  final String? action;

  @override
  State<_OrderSheet> createState() => _OrderSheetState();
}

class _OrderSheetState extends State<_OrderSheet> {
  final _text = TextEditingController();
  Map<String, dynamic>? _full;
  String _how = 'cash';
  bool _busy = false;
  bool _rejecting = false;
  String? _error;
  final Set<int> _picked = {};

  int get _id => _int(widget.order['id']);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/orders/$_id');
      if (!mounted) return;
      setState(() {
        _full = (r['order'] as Map).cast<String, dynamic>();
        _error = null;
      });
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _send(String path, Map<String, dynamic> body) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(path, body);
      HapticFeedback.mediumImpact();
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  List<Map<String, dynamic>> get _items =>
      ((_full?['items'] as List?) ?? const [])
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();

  List<Widget> _actions() {
    final again = (_) => setState(() {});
    switch (widget.action) {
      case 'release':
        final all = _full != null &&
            _items.isNotEmpty &&
            _items.every((i) => _picked.contains(_int(i['id'])));
        return [
          _Field(
            controller: _text,
            hint: 'Who is collecting? (optional)',
            capitalisation: TextCapitalization.words,
          ),
          const SizedBox(height: 12),
          _BigButton(
            all ? 'Release the goods' : 'Tick every item first',
            all
                ? () => _send('/api/store/orders/$_id/release',
                    {'collectedBy': _text.text.trim()})
                : null,
            busy: _busy,
            tint: _green,
          ),
        ];
      case 'pay':
        final needsRef = _how != 'cash';
        final ok = _full != null &&
            (!needsRef || _text.text.trim().length >= 4);
        return [
          Row(children: [
            for (final m in const ['cash', 'mobile_money', 'card']) ...[
              Expanded(
                child: _Pressable(
                  scale: 0.96,
                  onTap: () => setState(() => _how = m),
                  child: Container(
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _how == m ? _brand : _tile,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _hairline),
                    ),
                    child: Text(_method(m),
                        maxLines: 1,
                        style: _txt(12.5,
                            weight: FontWeight.w700,
                            color: _how == m ? _white : _inkSoft)),
                  ),
                ),
              ),
              if (m != 'card') const SizedBox(width: 8),
            ],
          ]),
          if (needsRef) ...[
            const SizedBox(height: 10),
            _Field(
              controller: _text,
              hint: 'Transaction ID',
              capitalisation: TextCapitalization.characters,
              onChanged: again,
            ),
          ],
          const SizedBox(height: 12),
          _BigButton(
            'Received ${_ugx(_int(widget.order['total']))}',
            ok
                ? () => _send('/api/cashier/orders/$_id/payment', {
                      'method': _how,
                      'amountPaid': _int(_full!['total']),
                      'transactionRef': needsRef ? _text.text.trim() : null,
                    })
                : null,
            busy: _busy,
          ),
        ];
      case 'verify':
        if (_rejecting) {
          return [
            _Field(
              controller: _text,
              hint: 'Why is it going back? The cashier reads this.',
              maxLines: 2,
              autofocus: true,
              onChanged: again,
            ),
            const SizedBox(height: 12),
            _BigButton(
              'Send back to the cashier',
              _text.text.trim().length >= 3
                  ? () => _send('/api/accounts/orders/$_id/verify',
                      {'approve': false, 'remarks': _text.text.trim()})
                  : null,
              busy: _busy,
              tint: _ember,
            ),
            TextButton(
              onPressed: () => setState(() => _rejecting = false),
              child: Text('Back', style: _txt(13.5, color: _mid)),
            ),
          ];
        }
        return [
          _BigButton(
            'Money is in — verify',
            _full == null
                ? null
                : () => _send('/api/accounts/orders/$_id/verify',
                    {'approve': true}),
            busy: _busy,
            tint: _green,
          ),
          Center(
            child: TextButton(
              onPressed: _busy ? null : () => setState(() => _rejecting = true),
              child: Text('Something is wrong with it',
                  style: _txt(13.5, weight: FontWeight.w600, color: _ember)),
            ),
          ),
        ];
    }
    return const [];
  }

  Widget _line(String k, Object? v) => v == null || '$v'.isEmpty
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(bottom: 7),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 104, child: Text(k, style: _txt(13, color: _mid))),
              Expanded(
                  child: Text('$v', style: _txt(13, weight: FontWeight.w600))),
            ],
          ),
        );

  @override
  Widget build(BuildContext context) {
    final o = _full ?? widget.order;
    final payment = (_full?['payment'] as Map?)?.cast<String, dynamic>();
    final picking = widget.action == 'release';

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Text('${o['order_no']}',
                  style: _title(22, weight: FontWeight.w800)),
              const Spacer(),
              Text(_ugx(_int(o['total'])),
                  style: _title(18, weight: FontWeight.w800)),
            ]),
            const SizedBox(height: 12),
            _line('Customer', o['company_name'] ?? o['ordered_by_name']),
            _line('Phone', o['ordered_by_phone']),
            _line('Deliver to', o['delivery_address']),
            _line('Note', o['notes']),
            if (payment != null) ...[
              _line('Receipt', payment['receipt_no']),
              _line('Paid by', _method(payment['method'])),
              _line('Transaction', payment['transaction_ref']),
              _line('Cashier', payment['cashier_name']),
            ],
            const SizedBox(height: 8),
            if (_full == null && _error == null)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                    child: CircularProgressIndicator(color: _brand)),
              ),
            // Ticked one by one at the store: releasing without looking is
            // how the wrong bag leaves.
            for (final i in _items)
              _Pressable(
                scale: 0.99,
                onTap: picking
                    ? () => setState(() {
                          final id = _int(i['id']);
                          if (!_picked.remove(id)) _picked.add(id);
                        })
                    : null,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    if (picking) ...[
                      Icon(
                          _picked.contains(_int(i['id']))
                              ? Icons.check_circle_rounded
                              : Icons.radio_button_unchecked_rounded,
                          size: 22,
                          color: _picked.contains(_int(i['id']))
                              ? _green
                              : _light),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Text('${i['product_name']}',
                          style: _txt(14, weight: FontWeight.w600)),
                    ),
                    Text('${i['quantity']} ${i['unit'] ?? ''}',
                        style: _title(14.5)),
                  ]),
                ),
              ),
            if (payment?['has_proof'] == true) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.network(
                  '$_apiBase/api/payments/${payment!['id']}/proof',
                  headers: _headers(),
                  errorBuilder: (_, __, ___) => Text(
                      'The payment screenshot could not be shown.',
                      style: _txt(12.5, color: _mid)),
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
              if (_full == null)
                TextButton(
                    onPressed: _load,
                    child: Text('Try again',
                        style: _txt(13.5, color: _brandDark))),
            ],
            const SizedBox(height: 14),
            ..._actions(),
          ],
        ),
      ),
    );
  }
}

/// A request for money or for stock: raised at a desk, decided by the
/// manager, paid out by the cashier.
class _RequestCard extends StatefulWidget {
  const _RequestCard(this.request, {required this.desk, required this.done});
  final Map<String, dynamic> request;
  final String desk;
  final Future<void> Function() done;

  @override
  State<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<_RequestCard> {
  bool _busy = false;

  Future<void> _send(String step, Map<String, dynamic> body) async {
    setState(() => _busy = true);
    try {
      await _apiPost('/api/expenses/${_int(widget.request['id'])}/$step', body);
      await widget.done();
    } on _ApiError catch (e) {
      if (mounted) _toast(context, e.message, bad: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    final why = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ReasonSheet(),
    );
    if (why != null) await _send('decide', {'approve': false, 'note': why});
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.request;
    final status = '${e['status']}';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Expanded(
                child: Text('${e['details']}',
                    style: _txt(14.5, weight: FontWeight.w700))),
            const SizedBox(width: 10),
            Text(_ugx(_int(e['amount'])), style: _title(15)),
          ]),
          const SizedBox(height: 4),
          Text(
              '${e['ref']} · ${e['kind_label']} · ${e['raised_by'] ?? ''} · '
              '${_when(e['created_at']?.toString())}',
              style: _txt(12, color: _mid)),
          if ('${e['decision_note'] ?? ''}'.isNotEmpty)
            Text('“${e['decision_note']}”', style: _txt(12, color: _mid)),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: _Chip('${e['status_label']}',
                bg: status == 'declined'
                    ? _emberPale
                    : status == 'paid'
                        ? _greenPale
                        : _amberPale,
                fg: status == 'declined'
                    ? _ember
                    : status == 'paid'
                        ? _green
                        : _amber),
          ),
          if (widget.desk == 'manager' && status == 'raised') ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: _BigButton('Decline', _decline,
                      busy: _busy, tint: _ember, soft: true)),
              const SizedBox(width: 10),
              Expanded(
                  child: _BigButton(
                      'Approve', () => _send('decide', {'approve': true}),
                      busy: _busy, tint: _green)),
            ]),
          ],
          if (widget.desk == 'cashier' && status == 'approved') ...[
            const SizedBox(height: 12),
            _BigButton('Paid out in cash', () => _send('pay', {'method': 'cash'}),
                busy: _busy),
          ],
        ],
      ),
    );
  }
}

class _ReasonSheet extends StatefulWidget {
  const _ReasonSheet();

  @override
  State<_ReasonSheet> createState() => _ReasonSheetState();
}

class _ReasonSheetState extends State<_ReasonSheet> {
  final _why = TextEditingController();

  @override
  void dispose() {
    _why.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _Sheet(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Why is it declined?', style: _title(20)),
              const SizedBox(height: 12),
              _Field(
                controller: _why,
                hint: 'Whoever asked will read this',
                autofocus: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              _BigButton(
                'Decline',
                _why.text.trim().length >= 3
                    ? () => Navigator.of(context).pop(_why.text.trim())
                    : null,
                tint: _ember,
              ),
            ],
          ),
        ),
      );
}

class _RequestSheet extends StatefulWidget {
  const _RequestSheet();

  @override
  State<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<_RequestSheet> {
  final _details = TextEditingController();
  final _amount = TextEditingController();
  late String _kind = _Session().role == 'store' ? 'stock_use' : 'expense';
  // The manager is the approval, so theirs is recorded as it is saved.
  final bool _boss = _Session().role == 'manager';
  bool _paid = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _details.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost('/api/expenses', {
        'kind': _kind,
        'details': _details.text.trim(),
        'amount': _int(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')),
        if (_boss) 'settle': _paid ? 'paid' : 'approve',
        if (_boss) 'method': 'cash',
      });
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ok = _details.text.trim().length >= 3 &&
        _int(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) > 0;
    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Add expense', style: _title(20)),
            const SizedBox(height: 4),
            Text(
                _boss
                    ? 'It is approved as you save it.'
                    : 'The manager approves it before anything is paid.',
                style: _txt(13, color: _mid)),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (k, label) in const [
                ('expense', 'Shop expense'),
                ('stock_use', 'Items for the shop'),
                ('float', 'Till float'),
                ('advance', 'Advance'),
              ])
                _Pressable(
                  scale: 0.96,
                  onTap: () => setState(() => _kind = k),
                  child: _Chip(label,
                      bg: _kind == k ? _brand : _tile,
                      fg: _kind == k ? _white : _inkSoft),
                ),
            ]),
            const SizedBox(height: 12),
            _Field(
              controller: _details,
              hint: 'What is it for?',
              capitalisation: TextCapitalization.sentences,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            _Field(
              controller: _amount,
              hint: 'Amount in UGX',
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
            ),
            if (_boss) ...[
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final (paid, label) in const [
                  (true, 'Already paid in cash'),
                  (false, 'Cashier to pay'),
                ])
                  _Pressable(
                    scale: 0.96,
                    onTap: () => setState(() => _paid = paid),
                    child: _Chip(label,
                        bg: _paid == paid ? _brand : _tile,
                        fg: _paid == paid ? _white : _inkSoft),
                  ),
              ]),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: _txt(13, color: _ember)),
            ],
            const SizedBox(height: 14),
            _BigButton(_boss ? 'Add expense' : 'Send to the manager',
                ok ? _submit : null,
                busy: _busy),
          ],
        ),
      ),
    );
  }
}

class _AccountTab extends StatelessWidget {
  const _AccountTab({required this.onSignOut});
  final Future<void> Function() onSignOut;

  @override
  Widget build(BuildContext context) {
    final s = _Session();
    return Column(
      children: [
        _Header(subtitle: '${_deskName(s.role)} · ${s.fullName}'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 20),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: _cardBox(),
                child: Column(children: [
                  Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: _heroGradient,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Text(
                        s.fullName.isEmpty
                            ? '?'
                            : s.fullName.substring(0, 1).toUpperCase(),
                        style: _title(28, color: _white)),
                  ),
                  const SizedBox(height: 14),
                  Text(s.fullName, style: _title(20)),
                  const SizedBox(height: 4),
                  Text(_deskName(s.role),
                      style: _txt(13.5,
                          weight: FontWeight.w600, color: _brandDark)),
                  const SizedBox(height: 4),
                  Text(s.phone, style: _txt(13, color: _mid)),
                ]),
              ),
              const SizedBox(height: 16),
              _BigButton('Sign out', onSignOut, tint: _ember, soft: true),
              const SizedBox(height: 10),
              Text('Signing out returns this phone to the shop.',
                  textAlign: TextAlign.center, style: _txt(12.5, color: _mid)),
            ],
          ),
        ),
      ],
    );
  }
}

void _toast(BuildContext context, String message, {bool bad = false}) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: bad ? _ember : _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text(message, style: _txt(13.5, color: _white)),
      ),
    );
