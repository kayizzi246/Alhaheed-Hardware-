// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedManager                   ║
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
//     AlHadeedManager
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
const Color _navy = Color(0xFF0E201A);
const Color _navyDark = Color(0xFF081511);
// #92D050 is the shop's green. It is light, so what sits on it is dark
// (_onLime); green words and marks on white use the deeper _brand.
const Color _lime = Color(0xFF92D050);
const Color _onLime = Color(0xFF102108);
const Color _brand = Color(0xFF3F7A12);
const Color _brandDark = Color(0xFF2F5E0C);
const Color _brandPale = Color(0xFFF0F8E6);
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
const List<BoxShadow> _cardShadow = [];

/// The brand's blue, deepening — hero cards, the header, the add button.
const LinearGradient _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_lime, _lime],
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
  final s = size * _ui * 0.92; // one size step smaller everywhere
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
    fill = [tint, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.16), _white.withOpacity(0.16)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, _white];
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
                colors: [_white, _white],
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
              const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
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
                    padding: const EdgeInsets.symmetric(vertical: 6),
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
                                size: 21,
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
                                            Border.all(color: _onLime, width: 2),
                                      ),
                                      constraints:
                                          const BoxConstraints(minWidth: 19),
                                      child: Text('$n',
                                          textAlign: TextAlign.center,
                                          style: _txt(10,
                                              weight: FontWeight.w800,
                                              color: _onLime)),
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
            colors: [_lime, _lime],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
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
                    _white.withOpacity(0),
                    _white.withOpacity(0),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, MediaQuery.paddingOf(context).top + 10, 14, 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _onLime.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _onLime.withOpacity(0.18)),
                    ),
                    child: Text('AH',
                        style: _title(14,
                            weight: FontWeight.w800, color: _onLime)),
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
                                weight: FontWeight.w800, color: _onLime)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _txt(12.5, color: _onLime.withOpacity(0.92))),
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
                        ? [_emberPale, _emberPale]
                        : [_brandPale, _brandPale],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                      color: tone == _ember
                          ? _ember.withOpacity(0.18)
                          : _brand.withOpacity(0.14)),
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
                    decoration: _liquid(tint: _lime, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _onLime)),
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

void _toast(BuildContext context, String message, {bool bad = false}) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: bad ? _ember : _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text(message, style: _txt(13.5, color: _white)),
      ),
    );

// ═══════════════════════════════════════════════════════════════
//  THE MANAGER SIDE
// ═══════════════════════════════════════════════════════════════

/// Where a manager's phone number lands after signing in.
///
/// The manager does not shop, so none of the customer chrome belongs
/// here — no cart, no bottom bar. One scrolling overview of the whole
/// shop, and the two things a manager actually has to *do* from a
/// phone: look into a stage that is backing up, and decide a refund.
class AlHadeedManager extends StatefulWidget {
  const AlHadeedManager({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on. They are not something to wire up, but the
  /// constructor has to accept them or saving fails with:
  /// Parameter "width" not found.
  final double? width;
  final double? height;

  @override
  State<AlHadeedManager> createState() => _AlHadeedManagerState();
}

class _AlHadeedManagerState extends State<AlHadeedManager> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _Session().load();
    if (!mounted) return;
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await _apiGet('/api/manager/dashboard');
      if (!mounted) return;
      setState(() {
        _data = r;
        _loading = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await _Session().signOut();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(PageRouteBuilder(
          pageBuilder: (_, __, ___) => const AlHadeedShop(),
          transitionDuration: Duration.zero,
        ));
        return;
      }
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _openStage(String stage, String label) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _StageSheet(stage: stage, label: label),
      );

  Future<void> _openRefund(Map<String, dynamic> refund) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _RefundSheet(refund: refund),
      ).then((decided) {
        if (decided == true) _load();
      });

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);

    return MediaQuery(
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
            body: Column(
              children: [
                _Header(
                  subtitle: 'Manager · ${_Session().fullName}',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _Pressable(
                        scale: 0.9,
                        onTap: _load,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: _liquid(circle: true, onDark: true),
                          child: const Icon(Icons.refresh_rounded,
                              size: 19, color: _onLime),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(child: _body(mq)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(MediaQueryData mq) {
    if (_loading) {
      return ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        children: [
          _Skeleton(mq.size.width - 28, 96, radius: 18),
          const SizedBox(height: 12),
          _Skeleton(mq.size.width - 28, 78, radius: 16),
          const SizedBox(height: 12),
          _Skeleton(mq.size.width - 28, 170, radius: 18),
        ],
      );
    }

    if (_error != null || _data == null) {
      return _Empty(
        icon: Icons.cloud_off_rounded,
        tone: _ember,
        title: "Couldn't load the dashboard",
        line: _error ?? 'Try again in a moment.',
        action: 'Try again',
        onAction: _load,
      );
    }

    final d = _data!;
    final byMethod = (d['byMethod'] as Map?)?.cast<String, dynamic>() ?? {};
    final byStage = (d['byStage'] as Map?)?.cast<String, dynamic>() ?? {};
    final lowStock =
        ((d['lowStock'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final refunds = ((d['pendingRefunds'] as List?) ?? const [])
        .cast<Map<String, dynamic>>();

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          // The headline. One number, stated in words — not a chart,
          // because there is nothing here to compare.
          // The day's sales, as the panel shows it: deep blue, the week
          // drawn faintly in its corner.
          Container(
            width: double.infinity,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              gradient: _heroGradient,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -50,
                  top: -70,
                  child: Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        _white.withOpacity(0),
                        _white.withOpacity(0),
                      ]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: _white.withOpacity(0.16),
                              borderRadius: BorderRadius.circular(11),
                              border: Border.all(
                                  color: _white.withOpacity(0.22)),
                            ),
                            child: const Icon(Icons.payments_outlined,
                                size: 18, color: _onLime),
                          ),
                          const SizedBox(width: 10),
                          Text('Sales today',
                              style: _txt(13,
                                  weight: FontWeight.w600,
                                  color: _onLime.withOpacity(0.85))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(_ugx((d['salesToday'] as num?)?.toInt() ?? 0),
                          style: _title(31,
                              weight: FontWeight.w800, color: _onLime)),
                      const SizedBox(height: 8),
                      Text('${d['ordersToday'] ?? 0} orders today',
                          style:
                              _txt(13, color: _onLime.withOpacity(0.8))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                  child: _tile('Cash', _ugx(
                      (byMethod['cash'] as num?)?.toInt() ?? 0),
                      icon: Icons.payments_outlined, accent: _green)),
              const SizedBox(width: 10),
              Expanded(
                  child: _tile('Mobile Money', _ugx(
                      (byMethod['mobile_money'] as num?)?.toInt() ?? 0),
                      icon: Icons.phone_iphone_rounded, accent: _brand)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: _tile('Card', _ugx(
                      (byMethod['card'] as num?)?.toInt() ?? 0),
                      icon: Icons.credit_card_rounded, accent: _blue)),
              const SizedBox(width: 10),
              Expanded(
                child: _tile(
                  'Low stock',
                  '${lowStock.length}',
                  tone: lowStock.isEmpty ? null : _ember,
                  icon: Icons.inventory_2_outlined,
                  accent: lowStock.isEmpty ? _green : _ember,
                ),
              ),
            ],
          ),

          const SizedBox(height: 22),
          Text('ORDERS BY STAGE (LIVE)',
              style: _txt(11.5, weight: FontWeight.w700, color: _light)),
          const SizedBox(height: 10),
          Row(
            children: [
              _stageTile('Cashier', 'cashier', byStage),
              const SizedBox(width: 8),
              _stageTile('Accounts', 'accounts', byStage),
              const SizedBox(width: 8),
              _stageTile('Store', 'store', byStage),
              const SizedBox(width: 8),
              _stageTile('Done', 'done', byStage, tappable: false),
            ],
          ),

          const SizedBox(height: 22),
          _salesChart(
              ((d['last7Days'] as List?) ?? const [])
                  .cast<Map<String, dynamic>>()),

          if (refunds.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('REFUNDS WAITING ON YOU',
                style: _txt(11.5, weight: FontWeight.w700, color: _light)),
            const SizedBox(height: 10),
            for (final r in refunds) _refundCard(r),
          ],

          if (lowStock.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('LOW STOCK',
                style: _txt(11.5, weight: FontWeight.w700, color: _light)),
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _hairline),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < lowStock.length; i++) ...[
                    if (i > 0)
                      const Padding(
                        padding: EdgeInsets.only(left: 14),
                        child: Divider(
                            height: 1, thickness: 1, color: _hairline),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    lowStock[i]['name'] as String? ?? '',
                                    style: _txt(13.5,
                                        weight: FontWeight.w600,
                                        color: _ink)),
                                const SizedBox(height: 2),
                                Text(
                                  'reorder at '
                                  '${lowStock[i]['reorder_level'] ?? 0}',
                                  style: _txt(12, color: _mid),
                                ),
                              ],
                            ),
                          ),
                          _Chip(
                            '${lowStock[i]['stock_available'] ?? 0} '
                            '${lowStock[i]['unit'] ?? ''} left',
                            bg: (lowStock[i]['stock_available'] as num?) == 0
                                ? _emberPale
                                : _brandPale,
                            fg: (lowStock[i]['stock_available'] as num?) == 0
                                ? _ember
                                : _brandDark,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// A figure, as the panel draws one: an icon in a soft tinted tile,
  /// the label beside it, the number large beneath.
  Widget _tile(String label, String value,
          {Color? tone, IconData? icon, Color accent = _brand}) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _hairline.withOpacity(0.7)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(12, weight: FontWeight.w600, color: _mid)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _title(18,
                    weight: FontWeight.w800, color: tone ?? _ink)),
          ],
        ),
      );

  Widget _stageTile(String label, String key, Map<String, dynamic> byStage,
      {bool tappable = true}) {
    final n = (byStage[key] as num?)?.toInt() ?? 0;
    return Expanded(
      child: _Pressable(
        scale: 0.95,
        onTap: tappable && n > 0 ? () => _openStage(key, label) : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: n > 0 && tappable
                    ? _brand.withOpacity(0.22)
                    : _hairline.withOpacity(0.7)),
          ),
          child: Column(
            children: [
              // Blue where a desk has work; quiet where it has none.
              Text('$n',
                  style: _title(22,
                      weight: FontWeight.w800,
                      color: n > 0 && tappable ? _brand : _ink)),
              const SizedBox(height: 3),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(11.5, color: _mid)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _refundCard(Map<String, dynamic> r) => _Pressable(
        scale: 0.98,
        onTap: () => _openRefund(r),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _ember.withOpacity(0.35)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('#${r['order_no'] ?? ''}',
                            style: _txt(14,
                                weight: FontWeight.w700, color: _ink)),
                        const SizedBox(width: 8),
                        _Chip(_ugx((r['amount'] as num?)?.toInt() ?? 0),
                            bg: _emberPale, fg: _ember),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(r['reason'] as String? ?? '',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: _txt(12.5, color: _mid, height: 1.35)),
                    const SizedBox(height: 2),
                    Text('asked by ${r['requested_by_name'] ?? ''}',
                        style: _txt(11.5, color: _light)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  size: 20, color: _light),
            ],
          ),
        ),
      );

  // --- The chart --------------------------------------------------------

  /// Sales over the last seven days.
  ///
  /// One series, so no legend — the title names it. The orange of the
  /// bars does not carry 3:1 against this surface, so the figures are
  /// never left to colour alone: the day under every bar, and the exact
  /// amount for whichever day is selected (today, until you tap another).
  ///
  /// The API returns only days that had sales, so the missing ones are
  /// filled in at zero here. Seven bars with gaps is the truth; one bar
  /// labelled "last 7 days" is not.
  Widget _salesChart(List<Map<String, dynamic>> raw) {
    final byDay = <String, int>{
      for (final r in raw)
        (r['day'] as String? ?? ''): (r['total'] as num?)?.toInt() ?? 0,
    };

    final today = DateTime.now();
    final days = <(String, String, int, bool)>[];
    for (var i = 6; i >= 0; i--) {
      final d = DateTime(today.year, today.month, today.day)
          .subtract(Duration(days: i));
      final key = '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.add((key, i == 0 ? 'Today' : names[d.weekday - 1],
          byDay[key] ?? 0, i == 0));
    }

    final selected = _selectedDay.clamp(0, days.length - 1);
    final max = days.fold<int>(0, (m, d) => d.$3 > m ? d.$3 : m);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _hairline.withOpacity(0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sales, last 7 days', style: _title(15.5)),
          const SizedBox(height: 2),
          // The selected day, in words. This is the chart's label layer:
          // it is what makes the bars readable without relying on colour.
          Text(
            '${days[selected].$2} · ${_ugx(days[selected].$3)}',
            style: _txt(13, weight: FontWeight.w600, color: _brandDark),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 108,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < days.length; i++) ...[
                  if (i > 0) const SizedBox(width: 2),
                  Expanded(
                    child: _Pressable(
                      scale: 0.94,
                      onTap: () => setState(() => _selectedDay = i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Anchored to the baseline, rounded at the data
                          // end only, with a floor of 3px so a zero day is
                          // still visibly a day.
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 320),
                            curve: _ease,
                            height: max == 0
                                ? 3
                                : (3 + (days[i].$3 / max) * 82),
                            // The chosen day in solid green;
                            // the rest a pale wash of the same.
                            decoration: BoxDecoration(
                              gradient: i == selected
                                  ? _heroGradient
                                  : LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        _brand.withOpacity(0.22),
                                        _brand.withOpacity(0.22),
                                      ],
                                    ),
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(8),
                                  bottom: Radius.circular(3)),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            days[i].$2,
                            maxLines: 1,
                            overflow: TextOverflow.clip,
                            style: _txt(10.5,
                                weight: i == selected
                                    ? FontWeight.w700
                                    : FontWeight.w400,
                                color: i == selected ? _ink : _light),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 4),
          const Divider(height: 1, thickness: 1, color: _hairline),
          const SizedBox(height: 8),
          Text('Tap a day to read its total.',
              style: _txt(11.5, color: _light)),
        ],
      ),
    );
  }

  int _selectedDay = 6;
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — WHAT IS SITTING AT ONE STAGE
// ═══════════════════════════════════════════════════════════════

/// The orders waiting at a desk. The manager's question when a number
/// on the dashboard looks wrong is always "which ones?", so that is
/// one tap away.
class _StageSheet extends StatefulWidget {
  const _StageSheet({required this.stage, required this.label});

  final String stage;
  final String label;

  @override
  State<_StageSheet> createState() => _StageSheetState();
}

class _StageSheetState extends State<_StageSheet> {
  List<Map<String, dynamic>> _orders = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/orders/queue/${widget.stage}');
      if (!mounted) return;
      setState(() {
        _orders = (r['orders'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('At ${widget.label}', style: _title(21)),
            const SizedBox(height: 4),
            Text(
              _loading
                  ? 'Loading…'
                  : '${_orders.length} '
                      '${_orders.length == 1 ? 'order is' : 'orders are'} '
                      'waiting at this desk.',
              style: _txt(13, color: _mid, height: 1.45),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Column(
                children: [
                  _Skeleton(0, 64, radius: 14),
                  SizedBox(height: 8),
                  _Skeleton(0, 64, radius: 14),
                ],
              )
            else if (_error != null)
              Text(_error!, style: _txt(13.5, color: _ember))
            else if (_orders.isEmpty)
              Text('Nothing waiting here. The desk is clear.',
                  style: _txt(13.5, color: _mid))
            else
              for (final o in _orders)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _tile,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('#${o['order_no'] ?? ''}',
                                style: _txt(14,
                                    weight: FontWeight.w700, color: _ink)),
                            const SizedBox(height: 3),
                            Text(
                              '${o['company_name'] ?? o['ordered_by_name'] ?? ''}'
                              ' · ${_when(o['created_at'] as String?)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _txt(12, color: _mid),
                            ),
                          ],
                        ),
                      ),
                      Text(_ugx((o['total'] as num?)?.toInt() ?? 0),
                          style: _txt(14,
                              weight: FontWeight.w800, color: _ink)),
                    ],
                  ),
                ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — DECIDE A REFUND
// ═══════════════════════════════════════════════════════════════

/// Approve or decline, with a note. Approving moves money out of the
/// cash book and tells the customer, so the amount is stated in full
/// rather than abbreviated.
class _RefundSheet extends StatefulWidget {
  const _RefundSheet({required this.refund});

  final Map<String, dynamic> refund;

  @override
  State<_RefundSheet> createState() => _RefundSheetState();
}

class _RefundSheetState extends State<_RefundSheet> {
  final _notes = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _decide(bool approve) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(
        '/api/manager/refunds/${(widget.refund['id'] as num).toInt()}/decide',
        {'approve': approve, 'notes': _notes.text.trim()},
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.refund;
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Refund on #${r['order_no'] ?? ''}', style: _title(21)),
            const SizedBox(height: 4),
            Text('Asked by ${r['requested_by_name'] ?? ''}',
                style: _txt(13, color: _mid)),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _emberPale,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AMOUNT TO REFUND',
                      style: _txt(11,
                          weight: FontWeight.w700, color: _ember)),
                  const SizedBox(height: 6),
                  Text(_ugx((r['amount'] as num?)?.toInt() ?? 0),
                      style: _title(24,
                          weight: FontWeight.w800, color: _ember)),
                  const SizedBox(height: 8),
                  Text(r['reason'] as String? ?? '',
                      style: _txt(13, color: _inkSoft, height: 1.45)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _Field(
              controller: _notes,
              hint: 'A note for the record (optional)',
              maxLines: 2,
              capitalisation: TextCapitalization.sentences,
            ),
            const SizedBox(height: 10),
            Text(
              'Approving takes this out of the cash book and tells the '
              'customer. It cannot be undone in the app.',
              style: _txt(12, color: _light, height: 1.45),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 16, color: _ember),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(_error!,
                        style: _txt(12.5, color: _ember, height: 1.4)),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: _busy ? null : () => _decide(false),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _tile,
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(color: _hairline),
                      ),
                      child: Text('Decline',
                          style: _txt(14.5,
                              weight: FontWeight.w600, color: _inkSoft)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: _busy ? null : () => _decide(true),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: _liquid(tint: _green, radius: 25),
                      child: _busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: _white),
                            )
                          : Text('Approve refund',
                              style: _txt(14.5,
                                  weight: FontWeight.w600, color: _white)),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — WHO AM I (and sign out)
// ═══════════════════════════════════════════════════════════════

class _ProfileSheet extends StatelessWidget {
  const _ProfileSheet();

  @override
  Widget build(BuildContext context) {
    final s = _Session();
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                      color: _brandPale, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: Text(
                    s.fullName.isEmpty
                        ? '?'
                        : s.fullName.characters.first.toUpperCase(),
                    style:
                        _title(22, weight: FontWeight.w800, color: _brandDark),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.fullName, style: _title(18)),
                      const SizedBox(height: 3),
                      Text(s.phone, style: _txt(13, color: _mid)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _row('Signed in as', 'Manager'),
            _row('Shop', 'Al Hadeed Hardware'),
            const SizedBox(height: 20),
            _Pressable(
              scale: 0.98,
              onTap: () async {
                final navigator = Navigator.of(context);
                await _Session().signOut();
                await _CartStore().clear();
                navigator.pop();
              },
              child: Container(
                height: 46,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _emberPale,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Text('Sign out',
                    style: _txt(15, weight: FontWeight.w600, color: _ember)),
              ),
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(k, style: _txt(14, color: _mid))),
            const SizedBox(width: 12),
            Expanded(
              child: Text(v,
                  textAlign: TextAlign.right,
                  style: _txt(14, weight: FontWeight.w600, color: _ink)),
            ),
          ],
        ),
      );
}
